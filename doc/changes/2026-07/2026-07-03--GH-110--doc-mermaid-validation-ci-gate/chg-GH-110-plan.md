---
id: chg-GH-110-doc-mermaid-validation-ci-gate
status: Proposed
created: 2026-07-03T00:00:00Z
last_updated: 2026-07-03T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: doc-validation
labels: ["ci", "docs", "mermaid", "guard", "drift-detection", "epic-107"]
links:
  change_spec: ./chg-GH-110-spec.md
  test_plan: ./chg-GH-110-test-plan.md
  related_changes:
    - GH-67
  epic:
    - GH-107
summary: >
  Add the first automated guardrail over doc/** — a headless mermaid render validator
  (scripts/validate-mermaid.sh) that ALSO keyword-guards the non-render-safe C4 denylist
  (DEC-7 AND-semantics: a block passes iff its mmdc render exits 0 AND it contains no C4
  keyword), a dedicated doc-path-scoped CI workflow (docs (mermaid validate)), a render-safe
  diagrams authoring rule (.ai/rules/diagrams.md), and a concise self-check wired into three
  doc-authoring agent prompts. The executable core is the validator + its Chromium-free test
  suite (mmdc mocked via MMDC_CMD); the workflow/rule/agent edits are verified by inspection
  and CI. The real-render green baseline is mmdc-gated and CI-only; ci.yml stays unchanged.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-110: Doc & mermaid validation CI gate

## Context and Goals

This plan delivers GH-110: the first automated guardrail over `doc/**` renderability. Today doc
surfaces have **zero** automated checks — a mermaid block that fails to render on GitHub passes
authoring, the inception gate, PR review, and CI. The motivating incident was a render-divergence
defect (`mmdc` renders Mermaid C4; GitHub does not), so this change closes that class at **two**
points: authoring time (agent self-check + the rule) and PR time (the CI gate running the validator).

The change is a single cohesive PR of six phased commits. The spec (`./chg-GH-110-spec.md`) is the
source of truth for all requirements (F-1–F-4, DM-1–DM-3, NFR-1–NFR-6, DEC-1–DEC-7, AC-F1-1…AC-F4-1);
the test plan (`./chg-GH-110-test-plan.md`, 22 TCs) defines the executable test surface and the
mocking strategy this plan must realize. This plan adds what those documents do not: the **phased,
committable task breakdown** for `@coder`, the **file-per-phase mapping**, and the **per-phase
verification commands**.

**The heart of the change is DEC-7 / NFR-5 (AND-semantics).** `validate-mermaid.sh` enforces BOTH
(1) mmdc renderability (via a mockable `MMDC_CMD` env seam) AND (2) a non-render-safe C4 keyword
guard (`C4Context`/`C4Container`/`C4Component`), configurable via `RENDER_SAFE_DENYLIST`. A block
passes **iff** the mmdc render exits 0 **and** no keyword matches. The keyword guard is a pure grep
that needs **no** `mmdc`, so it runs even under `--if-present` when the render is skipped — a C4
block cannot slip a tool-less local run (closes RSK-4). The denylist's single source of truth is
`.ai/rules/diagrams.md` (DM-3); the script's **default** denylist must mirror the rule's wording, so
the rule lands first (Phase 1).

**Resolved (no spec open questions remain):**

- **OQ-1 → DEC-7 (RESOLVED):** the script keyword-guards C4 in addition to rendering. Not re-litigated.
- **DEC-1/2/4/5** are binding and encoded below (dedicated workflow, regen `.ados-claude/`, agent set
  = `{spec-writer, doc-syncer, bootstrapper}`, `diagrams.md` carries **no** `ados_distribution` marker).

**Open questions (non-blocking, owned by `@coder` at delivery time — from test plan §8.3):**

- **OQ-TP-1:** `RENDER_SAFE_DENYLIST` override semantics — **replace** (default expectation, TC-MMD-008
  step 3 asserts replace) or **append**. Choose one, implement deterministically, document in the
  script header. Either is acceptable.
- **OQ-TP-2:** green baseline (TC-BASE-001) — a **self-skipping** test in `test-validate-mermaid.sh`
  (preferred, single source of truth) or a documented CI-only step. Self-skipping is preferred.
- **OQ-TP-3:** block index base — 0-based or 1-based. Either is fine if documented and consistent
  (TC-MMD-009 asserts correctness, not a specific base).

If any of the above needs a product/architecture call, note "Decision needed: consult
`@decision-advisor`" in the phase Execution Log and surface to `@pm`.

---

## Scope

### In Scope

- NEW `scripts/validate-mermaid.sh` — mermaid render + render-safe C4 keyword validator (F-1, DEC-7);
  `.ai/rules/bash.md`-compliant; scan roots `{doc, decisions, changes, inception, .ai}` over `.md`;
  `--if-present`/`--help`/`--version`; `MMDC_CMD` + `RENDER_SAFE_DENYLIST` env; documented exit codes;
  context-tagged logging; extracts ```mermaid fenced blocks; reports file+block-index+reason on
  failure; sorted/deterministic.
- NEW `scripts/.tests/test-validate-mermaid.sh` — Chromium-free test suite (F-1); bash.md §11 embedded
  framework; mocks mmdc via `MMDC_CMD` shim; covers TC-MMD-001…012 incl. the DEC-7 2×2 truth table and
  the mmdc-gated green-baseline self-skip (TC-BASE-001).
- NEW `.github/workflows/docs-mermaid-validate.yml` — dedicated, doc-path-scoped CI gate (F-2);
  `ci.yml` **unchanged** (DEC-1).
- NEW `.ai/rules/diagrams.md` + a `diagrams.md` row in `.ai/rules/README.md` (F-3; no marker — DEC-5).
- EDIT `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md` (F-4) + REGENERATE `.ados-claude/`
  via `scripts/build-claude-plugin.sh` (DEC-2).

### Out of Scope

- [OUT] Markdownlint config + job (NG-1 / DEC-6).
- [OUT] Re-rendering diagrams to committed image assets (NG-2).
- [OUT] Re-authoring existing blocks — the validator passes the current repo as-is (NG-3; green baseline).
- [OUT] Redistributing the validator or the rule to adopters (NG-4).
- [OUT] Editing `ci.yml` (DEC-1).
- [OUT] Authoring `doc/spec/features/feature-doc-mermaid-validation.md` (PM decision #5; `@doc-syncer`
  at lifecycle phase 7 — see Phase 6 note).
- [OUT] Extending the self-check to `plan-writer`/`test-plan-writer` (DEC-4; CI covers `changes/**`).

### Constraints

- **No hand-added license headers** on `scripts/` files. Verified: `scripts/add-header-location.sh`
  configures only `.opencode/agent`, `.opencode/command`, `doc/guides`, `doc/documentation-handbook.md`,
  `tools` — **`scripts/` is NOT a header path**. Do NOT add a copyright header to the new script/test.
- **Fast suite must stay Chromium-free.** Every render-dependent test injects a deterministic fake via
  the `MMDC_CMD` env seam (bash.md §10.1/§10.3). No test requires a real Chromium download. The only
  mmdc-requiring case (TC-BASE-001) self-skips locally.
- **`ci.yml` byte-for-byte unchanged** (DEC-1 / AC-F2-2). The gate is a separate workflow.
- **Determinism (NFR-1):** sorted file/block enumeration; no time/randomness/ordering dependence.
- **Single PR scope; do not merge; do not create the PR** (PM/`@pr-manager` owns phase 11).
- **Agent edits are minimal/concise** (1–2 lines each); do not rewrite the agents.
- **Staging discipline:** explicit-path `git add <path> ...` only; never `git add -A`/`.`/`-u`. Never stage
  `.ai/local/` (the git-ignored cross-change context — NOT committed). DO commit the change artifacts
  (`chg-GH-110-spec.md`, `chg-GH-110-test-plan.md`, `chg-GH-110-plan.md`, `chg-GH-110-pm-notes.yaml`) — these
  are durable records under `doc/changes/**` and belong in the PR. A dedicated Phase-0 artifacts commit stages
  them first (see Phases → Phase 0).

### Risks

- **RSK-2 / DEC-7 (render divergence, H/M → M):** `mmdc` renders C4 that GitHub does not. **Mitigation:**
  the script keyword-guards C4 in addition to rendering (DEC-7); the rule (Phase 1) keeps authoring
  inside the render-safe family set. Quadrant 2 of TC-MMD-012 (mmdc-OK + C4 → FAIL) is the regression guard.
- **RSK-1 (mmdc/Chromium heavy/flaky, M/M → M):** dedicated, doc-path-scoped job isolated from `ci.yml`;
  cache the puppeteer/Chromium install (NFR-2 < 120s). No Chromium in the fast suite (TR-1).
- **RSK-4 (`--if-present` local ambiguity, M/M → L-M):** CI is the hard gate (always installs mmdc); the
  keyword guard runs without mmdc under `--if-present` (TC-MMD-006). Mitigated by DEC-7.
- **RSK-5 (`.ados-claude/` regen drift, M/L → L):** Phase 5 regenerates + commits source and generated
  together; CI `verify-claude-build` enforces freshness (TC-AGENT-002).
- **RSK-6 / DEC-5 (marker confusion, L/L → L):** `diagrams.md` carries **no** `ados_distribution` marker;
  only the `.ai/rules/README.md` index row changes (README keeps its own marker). `test-doc-distribution.sh`
  stays green (TC-RULE-003).
- **TR-3 (AND-semantics mis-implemented as OR/render-only, H/L):** TC-MMD-012 walks the full 2×2 table.

### Success Metrics

| Metric | Target |
|--------|--------|
| `doc/**` paths with an automated renderability guard | 1 (today: 0) |
| Validator verdict determinism on a fixed repo state | 100% reproducible (sorted) |
| Validator failure-message completeness (file + block index + first error/keyword) | 3/3 on every failure |
| New runtime dependencies added to the existing `ci.yml` | 0 (dedicated workflow) |
| Doc-authoring agents carrying the rule + self-check | 3/3 chosen agents (DEC-4) |
| Validator passes the current repo (green baseline) | Yes (mmdc-gated; 0 `C4*` usage today) |

---

## Phases

> Each phase = **one** Conventional Commit, staging **only** the explicit paths listed (`git add
> <path>...`). Phases are ordered foundation-first: **rule → script → test → CI → agent edits + regen
> → verify + green baseline**. Pre-commit, run `git status --short` and confirm ONLY the phase's
> intended paths are staged. `@coder` delegates command execution to `@runner` and commits to
> `@committer`. Tick the task checkbox `[ ]` → `[x]` as each completes.

### Phase 0: Commit change artifacts

**Goal**: Land the change's own specification artifacts (spec, test-plan, plan, pm-notes) on the branch so the PR carries the durable record.

**Tasks**:

- [ ] **0.1** Stage ONLY the change artifacts (the four files in this folder: `chg-GH-110-spec.md`, `chg-GH-110-test-plan.md`, `chg-GH-110-plan.md`, `chg-GH-110-pm-notes.yaml`). Confirm `git status --short` shows ONLY these four paths staged — no `.ai/local/`, no deliverable files yet.
- [ ] **0.2** Commit via `@committer` (Conventional Commit type `docs`).

**Acceptance Criteria**: the four change artifacts are committed; working tree otherwise clean.

**Stage ONLY**: the four artifact paths in this change folder.

**Completion signal**: `docs(GH-110): add change artifacts (spec, test-plan, plan, pm-notes)`

---

### Phase 1: Render-safe diagrams rule + README index

**Goal**: Land `.ai/rules/diagrams.md` as the single source of truth (DM-3) for the render-safe family
allowlist and the C4 denylist **before** the script, so the script's default denylist mirrors its wording.

**Tasks**:

- [x] **1.1** Create `.ai/rules/diagrams.md` (kebab-case `.md`, per `.ai/rules/README.md` naming). Content:
  - **PREFER** GitHub-render-safe families: `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`.
  - **AVOID** Mermaid C4 (`C4Context` / `C4Container` / `C4Component`) — it renders in tooling but **not on GitHub**.
  - **Fallback:** if a C4 view is needed, author an equivalent `flowchart`.
  - **Self-check instruction:** before marking a doc DoR/DoD-passed, run `scripts/validate-mermaid.sh`
    (or grep the block for the non-render-safe keywords above as a cheap no-`mmdc` proxy).
  - Carry **NO** `ados_distribution` marker (DEC-5 — individual `.ai/rules/*.md` are not in the GH-67 DM-2
    scan set; only `.ai/rules/README.md` is marker-scanned).
  _(authored — read-only grep confirms: 4 families present [lines 10-13], 3 C4 keywords + "does not render on GitHub" + "equivalent flowchart" fallback present, 0 `ados_distribution` matches.)_
- [x] **1.2** Edit `.ai/rules/README.md`: add a `diagrams.md` row to the "Rule index" table
  (Task/Context = "Diagram authoring"; Rule File = `diagrams.md`; short description). Do **NOT** alter the
  README's existing `ados_distribution: redistributable` marker.
  _(authored — index row added [line 31]; README's own marker untouched [line 5, `redistributable`].)_
- [x] **1.3** Verify (per TC-RULE-001/002/003): the 4 render-safe families and the 3 C4 keywords and the
  flowchart fallback are present; `diagrams.md` has 0 `ados_distribution` matches; README has ≥1
  `diagrams.md` match; `bash scripts/.tests/test-doc-distribution.sh` exits 0.
  _(content checks PASSED via read-only grep; `test-doc-distribution.sh` run PENDING @runner — file-authoring-only mode.)_

**Acceptance Criteria**:

- Must: AC-F3-1 (rule states the 4 render-safe families).
- Must: AC-F3-2 (C4 avoidance rule + "author an equivalent flowchart" fallback).
- Must: AC-F3-3 — `diagrams.md` index row present and **no** marker on `diagrams.md` (DEC-5); distribution guard green.

**Files and modules**:

- `.ai/rules/diagrams.md` — new
- `.ai/rules/README.md` — updated (index row only)

**System docs to update**: none in this phase (the feature spec is authored at phase 7 by `@doc-syncer`).

**Tests**:

- `rg -n -e 'flowchart' -e 'sequenceDiagram' -e 'stateDiagram-v2' -e 'classDiagram' .ai/rules/diagrams.md` → all 4 present.
- `rg -n -e 'C4Context' -e 'C4Container' -e 'C4Component' .ai/rules/diagrams.md` → denylist present.
- `rg -n 'ados_distribution' .ai/rules/diagrams.md` → **0 matches** (DEC-5).
- `rg -n 'diagrams\.md' .ai/rules/README.md` → ≥1 match.
- `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (distribution guard unaffected).

**Stage ONLY**: `git add .ai/rules/diagrams.md .ai/rules/README.md`

**Completion signal**: `docs(GH-110): add render-safe diagrams rule + README index row`

---

### Phase 2: Validator script — render + C4 keyword guard (DEC-7)

**Goal**: Deliver `scripts/validate-mermaid.sh`, the core detection primitive implementing the DEC-7
dual check (renderability via `mmdc` **AND** no non-render-safe keyword).

**Tasks**:

- [x] **2.1** Create `scripts/validate-mermaid.sh` following `.ai/rules/bash.md` (§1 strict mode + traps;
  §5 context-tagged logging; §10 testability; §16 reference skeleton). `chmod +x` it. **No license header**
  (`scripts/` is not a header-configured path — verified). Context tag e.g. `(validate-mermaid)`.
  _(file authored [458 lines, strict-mode `set -Eeuo pipefail`+`errtrace`+`inherit_errexit`, ERR/EXIT/INT traps, `(validate-mermaid)` tag, testable main guard]; `chmod +x` + no-header PENDING @runner — file-authoring-only mode.)_
- [x] **2.2** Document and implement the **exit-code contract (DM-1 / bash.md §10.5):** `0` success; usage
  error; missing-`mmdc`-when-required; render failure; non-render-safe-keyword failure (distinct from
  render failure — TC-MMD-011). Header comment lists each.
  _(header lines 32-38 + `readonly EXIT_*` lines 53-57; precedence keyword(5) > render(4) > missing(3) > 0.)_
- [x] **2.3** **Scan roots (DM-2):** the union `{doc, decisions, changes, inception, .ai}` over `.md`
  files, **excluding git-ignored paths (notably `.ai/local/` ephemeral scratch)** — the script skips any
  `.md` under `.ai/local/`. In this repo `decisions/`, `changes/`, `inception/` live under `doc/`, so `doc/**`
  subsumes them; name the roots explicitly to mirror the CI `paths:` filter. Enumerate files **sorted** (NFR-1).
  _(`DEFAULT_SCAN_ROOTS` line 68; `enumerate_md_files` lines 317-340 handles dirs AND single-file args, excludes `*/.ai/local/*`, sorts via `sort -u`.)_
- [x] **2.4** **Extract** every ```mermaid fenced block from in-scope `.md` files; index blocks per file
  (record the chosen 0- vs 1-based base — OQ-TP-3; document it).
  _(`validate_file` lines 266-311; fence-length tracking defeats nested-fence false positives; **1-based** index, documented header line 21 [OQ-TP-3 RESOLVED].)_
- [x] **2.5** **Renderability check (DEC-7 part 1):** render each block headless via an injectable
  `readonly MMDC_CMD="${MMDC_CMD:-mmdc}"` (bash.md §10.1) invoked **only** through a mockable wrapper
  function (§10.3). A non-zero render exit is a render failure.
  _(`readonly MMDC_CMD` line 60; `_render` wrapper lines 175-189 writes `block.mmd`, captures stderr to `_LAST_RENDER_ERR`.)_
- [x] **2.6** **Render-safety keyword guard (DEC-7 part 2):** scan each block for the C4 denylist
  (`C4Context`/`C4Container`/`C4Component`) via a pure grep that needs **no** `mmdc`. The **default**
  denylist must mirror `.ai/rules/diagrams.md` wording (DM-3 single source of truth). Make it configurable
  via `RENDER_SAFE_DENYLIST` (choose replace-vs-append semantics per OQ-TP-1; default = **replace**; document
  in the header).
  _(`_keyword_guard` lines 155-169 [pure `grep -qF`]; `build_denylist` lines 127-132; default `C4Context C4Container C4Component` [line 73]; **REPLACE** semantics, documented header lines 26-29 [OQ-TP-1 RESOLVED].)_
- [x] **2.7** **AND-semantics (NFR-5 / DEC-7):** a block passes **iff** its `mmdc` render exits 0 **and**
  it contains no keyword. The keyword guard runs **even under `--if-present`** (the cheap grep is always
  available; it skips only the render when `mmdc` is absent).
  _(`validate_block` lines 229-254: keyword guard unconditionally first; render only if `_mmdc_available`; both failures recorded for one block; aggregate precedence in `main` lines 438-449.)_
- [x] **2.8** **Flags / behavior:** `--if-present` (no-op skip of the render when `mmdc` absent, exit 0 —
  NFR-3; keyword guard still runs), `--help` (prints `Usage:`), `--version` (prints a version string).
  Testable main guard (bash.md §10.4).
  _(`parse_args` lines 390-403; `usage` lines 359-388; testable main guard lines 456-457.)_
- [x] **2.9** **Failure messages (NFR-4):** every failure reports **file path + block index + first
  error/keyword (3/3)**. Emit GitHub `::error::` annotations where supported. Deterministic, sorted output.
  _(`_record_keyword_failure`/`_record_render_failure` lines 203-221: `log_err` (stderr) + `::error::` (stdout) both carry file+index+reason; first-error via `awk` line 243.)_

**Acceptance Criteria**:

- Must: AC-F1-1 (broken block ⇒ non-zero + file + block index + first error).
- Must: AC-F1-2 (valid render-safe block ⇒ exit 0).
- Must: AC-F1-4 (C4 keyword block ⇒ non-zero naming the keyword; runs without `mmdc` under `--if-present`;
  denylist configurable via `RENDER_SAFE_DENYLIST`).
- Should: NFR-6 conformance scaffold present (exit codes, `MMDC_CMD` injection, `--if-present`/`--help`/`--version`).

**Files and modules**:

- `scripts/validate-mermaid.sh` — new

**System docs to update**: none.

**Tests**:

- Smoke (interim, before the test lands in Phase 3): hand-build a temp `.md` with one broken block + a
  `MMDC_CMD` shim that exits non-zero, and one valid `flowchart` block + a success shim; confirm non-zero
  vs exit 0.
- `scripts/validate-mermaid.sh --help` exits 0 with `Usage:`; `--version` exits 0.

**Stage ONLY**: `git add scripts/validate-mermaid.sh`

**Completion signal**: `feat(GH-110): add validate-mermaid.sh render + C4 keyword guard`

---

### Phase 3: Chromium-free validator test suite

**Goal**: Deliver `scripts/.tests/test-validate-mermaid.sh` — the executable verification of every
validator behavior (TC-MMD-001…012) and the mmdc-gated green baseline (TC-BASE-001), with **no real
Chromium** in the fast suite.

**Tasks**:

- [x] **3.1** Create `scripts/.tests/test-validate-mermaid.sh` per bash.md §11 embedded framework
  (shebang, strict mode, `run_test`, `assert_*`, `print_summary` exit code, `trap` teardown in `mktemp -d`).
  Source `scripts/validate-mermaid.sh` via its testable main guard. `chmod +x` it (**required** — `test-all.sh`
  line 88 filters `-perm -u+x`; an unexecutable file is silently not discovered).
  _(file authored [649 lines, §11 framework: `run_test`/`assert_eq`/`assert_ne`/`assert_contains`/`assert_not_contains`/`assert_exit_code`/`assert_file_exists`/`print_summary`, mktemp-d trap teardown]; validator invoked as SUBPROCESS via `run_validator` (testable main guard enables both styles); `chmod +x` PENDING @runner.)_
- [x] **3.2** **Mock `mmdc` via `MMDC_CMD`** (TC-MMD-004): write deterministic success/fail shims to temp
  paths; assert the shim (not a real `mmdc`) is invoked. No network, no Chromium download (TR-1).
  _(`make_success_shim`/`make_fail_shim` lines 160-178; TC-MMD-004 asserts a `hit` marker file proves the shim ran.)_
- [x] **3.3** **TC-MMD-001 / 002:** broken block + fail shim ⇒ non-zero with file+index+error; valid
  `flowchart` + success shim ⇒ exit 0.
  _(test_mmd_001/002 lines 185-229.)_
- [x] **3.4** **TC-MMD-005 / 006 / 007 (keyword guard without `mmdc`):** C4 block fails naming the keyword
  with **no** `MMDC_CMD` set; C4 block still fails under `--if-present` when `mmdc` is absent (RSK-4/DEC-7);
  valid render-safe block passes under `--if-present` when `mmdc` absent (exit 0 + skip notice).
  _(test_mmd_005/006/007 lines 262-313; mmdc-absence made deterministic via bogus `MMDC_CMD` path, not relying on real absence.)_
- [x] **3.5** **TC-MMD-008:** `RENDER_SAFE_DENYLIST` override drives the keyword guard — assert the chosen
  replace-vs-append semantics (OQ-TP-1) and pin them.
  _(test_mmd_008 lines 316-360: 3-step REPLACE proof — custom kw flagged; default flags C4; override REPLACES default so C4 NOT flagged. Env-prefix `VAR=val run_validator` propagates to subprocess.)_
- [x] **3.6** **TC-MMD-009 / 010 / 011:** failure-message 3/3 for both failure kinds + multi-block
  per-file indexing; determinism (3× identical verdict, sorted enumeration); documented exit codes
  reachable & distinct (usage / missing-mmdc-when-required / render / keyword / success).
  _(test_mmd_009 [3/3 messages + multi-block #2] lines 363-428; test_mmd_010 [3× identical, sorted a- before z-] lines 431-466; test_mmd_011 [2/3/4/5/0 all reachable] lines 469-529.)_
- [x] **3.7** **TC-MMD-012 (DEC-7 AND-semantics 2×2 truth table):** quadrant 1 (mmdc-OK + no keyword) →
  PASS; quadrant 2 (mmdc-OK + C4) → **FAIL** (the motivating regression guard); quadrant 3 (mmdc-FAIL + no
  keyword) → FAIL; quadrant 4 (mmdc-FAIL + C4) → FAIL.
  _(test_mmd_012 lines 532-571: Q1 PASS / Q2 FAIL(5) / Q3 FAIL(4) / Q4 FAIL + surfaces keyword reason.)_
- [x] **3.8** **TC-MMD-003 (conformance):** `--help`/`--version` behavior; `shellcheck` clean;
  `shfmt -i 2 -ci -bn -d` clean; strict mode + traps + context tag + testable main guard present.
  _(`--help`/`--version` behavior test lines 232-239; shellcheck/shfmt RUN PENDING @runner [Phase 6.5].)_
- [x] **3.9** **TC-BASE-001 (green baseline, mmdc-gated):** self-skip when `command -v mmdc` is absent
  (OQ-TP-2 — self-skipping preferred); when `mmdc` is present, run the validator over the real DM-2 scan
  roots and assert exit 0. Keeps `test-all.sh` green on a tool-less runner.
  _(test_base_001 lines 617-625 [self-skip via `command -v mmdc` + yellow notice]; OQ-TP-2 RESOLVED = self-skipping.)_
- [x] **3.10** **TC-RULE-004 (DEC-7 drift guard, DoR iter-1 Minor):** assert the script's **default**
  denylist is byte-aligned with `.ai/rules/diagrams.md`'s C4 keywords (`C4Context`/`C4Container`/`C4Component`)
  — grep the script's default literal OR run it (no `RENDER_SAFE_DENYLIST` override) against a fixture with
  each keyword and assert each is flagged, and assert no extra/typo'd keyword diverges. This pins DM-3 parity.
  _(test_rule_004 lines 578-610: source-grep parity + behavioral parity for each of the 3 keywords.)_

**Acceptance Criteria**:

- Must: AC-F1-3 (test runs & passes directly and via `scripts/test-all.sh`; script follows bash.md).
- Must: AC-F1-4 fully covered (DEC-7 truth table + `--if-present` keyword guard).
- Must: DM-1 / NFR-1 / NFR-4 / NFR-5 / NFR-6 covered by the suite.

**Files and modules**:

- `scripts/.tests/test-validate-mermaid.sh` — new

**System docs to update**: none.

**Tests**:

- `bash scripts/.tests/test-validate-mermaid.sh` → exit 0.
- `bash scripts/test-all.sh` → the new test is auto-discovered and passes (confirm the executable bit).
- `shellcheck scripts/validate-mermaid.sh scripts/.tests/test-validate-mermaid.sh` → clean.
- `shfmt -i 2 -ci -bn -d scripts/validate-mermaid.sh scripts/.tests/test-validate-mermaid.sh` → no diff.

**Stage ONLY**: `git add scripts/.tests/test-validate-mermaid.sh`

**Completion signal**: `test(GH-110): add Chromium-free validate-mermaid test suite`

---

### Phase 4: Dedicated, doc-path-scoped CI workflow

**Goal**: Deliver the forcing function — `.github/workflows/docs-mermaid-validate.yml` — isolated from
`ci.yml`, so a broken/non-render-safe block is unmergeable. `ci.yml` stays byte-for-byte unchanged.

**Tasks**:

- [x] **4.1** Create `.github/workflows/docs-mermaid-validate.yml`:
  - Trigger `on: pull_request` with a `paths:` filter: `[doc/**, decisions/**, changes/**, inception/**,
    .ai/rules/**, scripts/validate-mermaid.sh, .github/workflows/**]` (mirrors DM-2).
  - Job name `docs (mermaid validate)`; `runs-on: ubuntu-latest`; `permissions: contents: read`.
  - **No** `pull_request_target` (no secret-surface widening); **no** deploy step (F-2 / security §21).
  - Step: install `@mermaid-js/mermaid-cli` (`mmdc`) via npm, with a puppeteer/Chromium cache step (NFR-2 < 120s).
  - Step: run `scripts/validate-mermaid.sh` over the scan roots; emit `::error::` on failure.
  - **No** `continue-on-error` / `|| true` — a non-zero exit fails the PR.
  _(file authored [49 lines]: `on: pull_request` + paths filter lines 9-18; `permissions: contents: read` line 21; job `docs (mermaid validate)` line 25; checkout/setup-node/puppeteer-cache/npm-install-g/chmod/validator-run steps; no `pull_request_target`, no `continue-on-error`, no `|| true`, no deploy — confirmed via Read.)_
- [x] **4.2** Create `scripts/.tests/test-docs-mermaid-workflow.sh` (NEW — TC-CI-003, the DoR iter-1 Major fix): an **executable** structural test of `.github/workflows/docs-mermaid-validate.yml`. `chmod +x` it (test-all.sh `-perm -u+x`). It must (a) grep-assert the required elements (`on:`, `pull_request`, a `paths:` filter, job `docs (mermaid validate)`, `runs-on: ubuntu-latest`, `permissions: contents: read`, mmdc/`@mermaid-js/mermaid-cli` install step, `validate-mermaid.sh` run step); (b) grep-assert the **absence** of `pull_request_target`, `continue-on-error`, `|| true`, deploy; (c) run `actionlint` if available (skip-notice if absent); (d) confirm the file parses as valid YAML if a YAML tool is available. Portable baseline = grep; enhancements self-adapt to tool availability.
  _(file authored [147 lines]: `test_required_elements_present` + `test_forbidden_elements_absent` [grep baseline] + `test_actionlint_when_available` [skip-notice] + `test_yaml_parses_when_available` [python3/yq skip-notice]; `chmod +x` PENDING @runner.)_
- [ ] **4.3** Confirm `.github/workflows/ci.yml` is unchanged (TC-CI-002): `git diff --stat -- .github/workflows/ci.yml` → empty.
  _(PENDING @runner — `git diff` requires shell; ci.yml was NOT opened/edited by @coder.)_
- [ ] **4.4** Inspect per TC-CI-001: paths filter, job name, `permissions: contents: read`, no
  `pull_request_target`, no deploy, mmdc install step, validator run step present.
  _(PASSED via Read inspection of the authored workflow; `actionlint` run PENDING @runner [Phase 6.5 / test-docs-mermaid-workflow.sh].)_

**Acceptance Criteria**:

- Must: AC-F2-1 (workflow triggers on doc-path PRs; benign; installs mmdc; runs the validator).
- Must: AC-F2-2 (a broken block fails the PR; `ci.yml` unchanged — DEC-1).

**Files and modules**:

- `.github/workflows/docs-mermaid-validate.yml` — new
- `scripts/.tests/test-docs-mermaid-workflow.sh` — new (TC-CI-003, executable structural test)
- `.github/workflows/ci.yml` — **unchanged** (verify empty diff)

**System docs to update**: none.

**Tests**:

- `bash scripts/.tests/test-docs-mermaid-workflow.sh` → exit 0 (grep structural + actionlint-when-present + YAML-parse-when-present; TC-CI-003).
- `git diff --stat -- .github/workflows/ci.yml` → empty (TC-CI-002).
- YAML structure inspection per TC-CI-001 (paths / job name / permissions / no `pull_request_target` /
  no deploy / mmdc install / validator run / no `continue-on-error`).
- (NFR-2 is CI-only; not asserted in the fast suite — note the Chromium-cache step is present.)

**Stage ONLY**: `git add .github/workflows/docs-mermaid-validate.yml scripts/.tests/test-docs-mermaid-workflow.sh`

**Completion signal**: `ci(GH-110): add doc-path-scoped mermaid validate workflow + structural test`

---

### Phase 5: Authoring self-check in three agents + regenerate `.ados-claude/`

**Goal**: Wire a concise rule reference + self-check into the three doc-authoring agent prompts that emit
mermaid blocks (DEC-4), and regenerate the Claude Code plugin so source + generated are committed fresh (DEC-2).

**Tasks**:

- [x] **5.1** Edit `.opencode/agent/spec-writer.md`, `.opencode/agent/doc-syncer.md`, and
  `.opencode/agent/bootstrapper.md`: add a concise **1–2 line** reference to `.ai/rules/diagrams.md` plus
  the self-check (run `scripts/validate-mermaid.sh`, or grep the block for non-render-safe keywords as a
  cheap no-`mmdc` proxy) **before marking a doc DoR/DoD-passed**. Minimal edit; do not rewrite the agents.
  _(all 3 authored: spec-writer.md line 216 [`<validation>` bullet]; doc-syncer.md line 145 [`<rules>` rule, before `</rules>`]; bootstrapper.md line 233 [`<output_expectations>` note]. Read-only grep confirms each has `diagrams.md` + `validate-mermaid` + `non-render-safe` + `C4Context`. Excluded agents `decision-advisor`/`editor`/`meeting-organizer` NOT edited [DEC-4].)_
- [ ] **5.2** Regenerate the plugin: `bash scripts/build-claude-plugin.sh` (DEC-2). The three corresponding
  `.ados-claude/agent/*` files change; commit **source + generated together**.
  _(PENDING @runner/PM — regen requires shell; @coder does NOT hand-edit `.ados-claude/`.)_
- [ ] **5.3** Verify (TC-AGENT-001): each of the 3 agents grep-matches `diagrams.md` and a self-check term
  (`validate-mermaid` / `non-render-safe` / `grep … C4`). Confirm the **excluded** agents
  (`decision-advisor`, `editor`, `meeting-organizer`) are **not** edited (DEC-4).
  _(PASSED via read-only grep for the 3 chosen agents; negative `git diff --name-only` for the excluded set PENDING @runner.)_
- [ ] **5.4** Verify (TC-AGENT-002): after regen, `git status --short -- .ados-claude/` is clean for the
  changed agents; re-running `build-claude-plugin.sh` is a no-op (deterministic). `bash scripts/.tests/test-build-claude-plugin.sh` passes.
  _(PENDING @runner — requires regen + shell.)_

**Acceptance Criteria**:

- Must: AC-F4-1 — each chosen agent carries the rule reference + self-check; `.ados-claude/` regenerated
  and committed fresh (DEC-2 / DEC-4).

**Files and modules**:

- `.opencode/agent/spec-writer.md`, `.opencode/agent/doc-syncer.md`, `.opencode/agent/bootstrapper.md` — updated
- `.ados-claude/agent/*` (corresponding) — regenerated

**System docs to update**: none (AGENTS.md index is unaffected; no new tool added).

**Tests**:

- For each agent: `rg -n -e 'diagrams\.md' -e '\.ai/rules/diagrams' .opencode/agent/<agent>.md` → ≥1 match.
- For each agent: `rg -n -i -e 'validate-mermaid' -e 'non-render-safe' -e 'grep.*C4' .opencode/agent/<agent>.md` → ≥1 match.
- Negative: `git diff --name-only -- .opencode/agent/` shows only the 3 chosen files.
- `bash scripts/build-claude-plugin.sh` → exit 0; `git diff --stat -- .ados-claude/` empty after commit (idempotent).
- `bash scripts/.tests/test-build-claude-plugin.sh` → pass.

**Stage ONLY**: `git add .opencode/agent/spec-writer.md .opencode/agent/doc-syncer.md .opencode/agent/bootstrapper.md .ados-claude/`

**Completion signal**: `feat(GH-110): wire diagrams self-check into doc-authoring agents; regen plugin`

---

### Phase 6: Verification & green baseline

**Goal**: Prove the change is green end-to-end across all verification gates and the validator passes the
real repo doc tree, before handing to downstream lifecycle phases (system_spec_update → review → quality
gates → DoD → PR). This phase produces **no code commit** unless a regression is found (a targeted
`fix`/`test` commit then follows, with explicit-path staging).

**Tasks**:

- [ ] **6.1** `bash scripts/.tests/test-validate-mermaid.sh` → exit 0 (TC-MMD-001…012 + TC-BASE-001 self-skip locally).
- [ ] **6.2** `bash scripts/test-all.sh` → all green. **Note:** pre-existing external `text-to-image` failures
  (if any, unrelated to this change) are out of scope — record them, do not chase them.
- [ ] **6.3** `bash scripts/build-claude-plugin.sh` → exit 0; `git status --short -- .ados-claude/` clean for
  the Phase-5 agent edits (TC-AGENT-002 freshness).
- [ ] **6.4** `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (`diagrams.md` is out of DM-2; README
  marker untouched — TC-RULE-003).
- [ ] **6.5** `shellcheck scripts/validate-mermaid.sh scripts/.tests/test-validate-mermaid.sh` → clean;
  `shfmt -i 2 -ci -bn -d scripts/validate-mermaid.sh scripts/.tests/test-validate-mermaid.sh` → no diff.
- [ ] **6.6** **Green baseline (TC-BASE-001):** run the validator over the real repo doc tree. If `mmdc` is
  installed locally, expect exit 0 (0 `C4*` usage today — spec Appendix A); if `mmdc` is absent, the run
  self-skips (exit 0) and CI performs the real baseline. Record the outcome.
- [ ] **6.7** Header hygiene: confirm **no hand-added license header** on `scripts/validate-mermaid.sh` or
  its test (only `scripts/add-header-location.sh` manages headers on its configured paths).
- [ ] **6.8** **Downstream phase-7 dependency (PM decision #5):** `@doc-syncer` authors
  `doc/spec/features/feature-doc-mermaid-validation.md` (new feature area; delivery mode autonomous →
  in-change) at lifecycle phase 7 (`system_spec_update`). The plan/coder does **not** author it — flag it
  for `@pm` to hand off.
- [ ] **6.9** Handoff to `review_fix` (lifecycle phase 8) and `quality_gates` (phase 9). **CEO-gated PR
  flag (AC#5 / DEC-3):** because this change touches `scripts/` + `.github/`, the PR description (opened
  by `@pr-manager` at phase 11) surfaces a **review flag** for the human reviewer — it is a release flag,
  **not** an automated gate. Do **NOT** merge or create the PR here.

**Acceptance Criteria**:

- Must: all verification gates green; validator green-baseline-confirmed (mmdc-gated) or self-skipped locally.
- Must: no hand-added headers; `.ados-claude/` current; `ci.yml` unchanged; distribution guard green.
- Should: all 10 runtime ACs demonstrably covered (see AC Coverage Map).

**Files and modules**: none committed by default (a regression fix, if needed, gets its own targeted commit).

**System docs to update** (downstream, not by this phase): `doc/spec/features/feature-doc-mermaid-validation.md`
(authored by `@doc-syncer` at phase 7 — note as a dependency).

**Tests**: the six gate runs above are the verification.

**Completion signal**: No commit (green baseline). Downstream: `@doc-syncer` (phase 7) → `@reviewer` →
`@runner` quality gates → `@pm` DoD → `@pr-manager` PR.

---

## Test Scenarios

> The authoritative case matrix is `./chg-GH-110-test-plan.md` (22 TCs). This table maps each TC to its
> delivery phase and the AC(s) it proves; do not duplicate the full case bodies here.

| TC ID | Scenario (condensed) | Phase | AC / NFR |
|-------|----------------------|:-----:|----------|
| TC-MMD-001 | Broken block ⇒ non-zero + file + index + error (mock mmdc fail) | 3 | AC-F1-1, NFR-4 |
| TC-MMD-002 | Valid render-safe block ⇒ exit 0 (mock mmdc ok) | 3 | AC-F1-2, NFR-5 |
| TC-MMD-003 | Harness + script bash.md conformance | 2, 3 | AC-F1-3, NFR-6 |
| TC-MMD-004 | `MMDC_CMD` dependency injection (no Chromium) | 2, 3 | AC-F1-3, NFR-6, NFR-1 |
| TC-MMD-005 | C4 keyword block fails naming keyword (DEC-7) | 2, 3 | AC-F1-4, DM-1, DM-3, NFR-5 |
| TC-MMD-006 | C4 keyword fails under `--if-present` even when mmdc absent | 2, 3 | AC-F1-4, NFR-3 |
| TC-MMD-007 | Valid render-safe block passes under `--if-present` (mmdc absent) | 2, 3 | AC-F1-4, NFR-3 |
| TC-MMD-008 | `RENDER_SAFE_DENYLIST` override drives the keyword guard | 2, 3 | AC-F1-4, DM-1 |
| TC-MMD-009 | Failure-message completeness 3/3 + multi-block indexing | 3 | AC-F1-1, AC-F1-4, NFR-4 |
| TC-MMD-010 | Determinism — identical verdict; sorted file order | 3 | NFR-1 |
| TC-MMD-011 | Documented exit codes reachable & distinct | 2, 3 | DM-1, NFR-6 |
| TC-MMD-012 | AND-semantics 2×2 truth table (DEC-7) | 3 | DM-1, NFR-5, DEC-7 |
| TC-BASE-001 | Validator passes real repo doc tree (mmdc-gated self-skip) | 6 | AC-F1-2, DM-2, NFR-1 |
| TC-CI-001 | `docs-mermaid-validate.yml` inspection — benign, doc-path-scoped | 4 | AC-F2-1, AC-F2-2, DEC-1, NFR-2 |
| TC-CI-002 | `ci.yml` unchanged (DEC-1) | 4 | AC-F2-2, DEC-1 |
| TC-CI-003 | Workflow structural validity (grep + `actionlint`) — executable | 4 | AC-F2-1, AC-F2-2, DEC-1 |
| TC-RULE-001 | `diagrams.md` states 4 render-safe families | 1 | AC-F3-1, DM-3 |
| TC-RULE-002 | `diagrams.md` C4 avoidance + flowchart fallback | 1 | AC-F3-2, DM-3 |
| TC-RULE-003 | README index row present; `diagrams.md` NO marker (DEC-5) | 1 | AC-F3-3, DEC-5 |
| TC-RULE-004 | Script default denylist mirrors `diagrams.md` (DM-3 drift guard) | 3 | DM-3, DEC-7 |
| TC-AGENT-001 | 3 agents reference `diagrams.md` + self-check | 5 | AC-F4-1, DEC-4 |
| TC-AGENT-002 | `.ados-claude/` regenerated fresh (build invariant) | 5, 6 | AC-F4-1, DEC-2 |

---

## AC Coverage Map

| AC | Phase(s) | Status |
|----|:--------:|--------|
| AC-F1-1 (broken block ⇒ non-zero + file + block index + first error) | 2, 3 | Covered |
| AC-F1-2 (valid render-safe block ⇒ exit 0) | 2, 3, 6 | Covered |
| AC-F1-3 (test runs & passes; script follows bash.md) | 2, 3 | Covered |
| AC-F1-4 (C4 keyword fails naming keyword; runs under `--if-present` w/o mmdc; denylist configurable) | 2, 3 | Covered |
| AC-F2-1 (dedicated workflow; benign; installs mmdc; runs validator) | 4 | Covered |
| AC-F2-2 (broken block fails PR; `ci.yml` unchanged) | 4 | Covered |
| AC-F3-1 (rule states 4 render-safe families) | 1 | Covered |
| AC-F3-2 (C4 avoidance + flowchart fallback) | 1 | Covered |
| AC-F3-3 (README index row; `diagrams.md` no marker — DEC-5) | 1 | Covered |
| AC-F4-1 (3 agents carry rule ref + self-check; plugin regenerated) | 5, 6 | Covered |
| AC#5 (CEO-gated PR — DEC-3) | 6 (handoff) | Review/release flag (not a runtime AC); surfaced in PR description by `@pr-manager` |

**Coverage: 10 / 10 runtime ACs fully covered.** (AC#5 / DEC-3 is a review/release flag surfaced in the
PR description, intentionally not a runtime AC per spec §17 E.) AC-F2-1/F2-2 are now backed by the
**executable** structural test TC-CI-003 (DoR iter-1 Major fix), not eyeball-only.

---

## Flagged Items

- **F-1 (DEC-7 is the load-bearing decision):** the script MUST enforce BOTH renderability AND the C4
  keyword guard (AND-semantics). Quadrant 2 of TC-MMD-012 (mmdc-OK + C4 → FAIL) is the regression guard for
  the motivating incident. Do not implement render-only or OR-semantics.
- **F-2 (DM-3 single source of truth):** the script's default `RENDER_SAFE_DENYLIST` must mirror
  `.ai/rules/diagrams.md`. This is why the rule lands in Phase 1, before the script (Phase 2).
- **F-3 (Chromium-free fast suite — TR-1):** every render-dependent test injects a fake `mmdc` via `MMDC_CMD`;
  the only mmdc-requiring case (TC-BASE-001) self-skips locally. `scripts/test-all.sh` must stay green and
  fast on a tool-less runner.
- **F-4 (Executable bit — `test-all.sh` discovery):** `test-all.sh` filters on `-perm -u+x` (line 88), so
  `scripts/.tests/test-validate-mermaid.sh` (and `scripts/validate-mermaid.sh`) must be `chmod +x` or they
  will not be discovered/run.
- **F-5 (Version bump — N/A):** `version_impact: minor` is informational; this template/framework repo has
  no SemVer file (no `package.json`/`VERSION`). Per repo convention there is no version artifact to bump;
  the "release" is the merged PR. Noted explicitly per plan authoring rules.
- **F-6 (Spec reconciliation — lifecycle phase 7):** this is a new feature area; no
  `doc/spec/features/feature-doc-mermaid-validation.md` exists. Per PM decision #5, `@doc-syncer` authors it
  in-change at phase 7 (delivery mode autonomous). The plan-writer/coder does **not** author it — flagged
  for `@pm` handoff in Phase 6.8.
- **F-7 (CEO-gated PR — AC#5 / DEC-3):** a review/release flag surfaced in the PR description (the change
  touches `scripts/` + `.github/`); not an automated gate. Handled by `@pr-manager` at phase 11.

---

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-110-spec.md | Spec (source of truth) |
| Test plan | ./chg-GH-110-test-plan.md | Test plan (22 TCs) |
| Implementation plan | ./chg-GH-110-plan.md | Plan (this file) |
| Related change | GH-67 (doc-distribution guard) | Related (same drift/gate family) |
| Epic | GH-107 (drift detection & gate enforcement) | Epic |
| Bash rule | [.ai/rules/bash.md](../../../../.ai/rules/bash.md) | Script/test standard (NFR-6) |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Test layers/conventions |

**Files touched by delivery (summary):**

| Path | Phase | New/Updated |
|------|:-----:|:-----------:|
| `.ai/rules/diagrams.md` | 1 | new |
| `.ai/rules/README.md` | 1 | updated (index row) |
| `scripts/validate-mermaid.sh` | 2 | new |
| `scripts/.tests/test-validate-mermaid.sh` | 3 | new |
| `scripts/.tests/test-docs-mermaid-workflow.sh` | 4 | new (TC-CI-003 structural) |
| `.github/workflows/docs-mermaid-validate.yml` | 4 | new |
| `.github/workflows/ci.yml` | — | **unchanged** (DEC-1) |
| `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md` | 5 | updated |
| `.ados-claude/agent/*` (corresponding) | 5 | regenerated |
| `doc/spec/features/feature-doc-mermaid-validation.md` | phase 7 (`@doc-syncer`) | new (downstream — not by this plan) |

---

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | plan-writer | Initial plan: 6 phases foundation-first (rule → script → test → CI → agents+regen → verify+green baseline); encodes DEC-7 AND-semantics (dual render + C4 keyword guard), `MMDC_CMD` Chromium-free mock strategy, mmdc-gated self-skipping green baseline; phase→AC map (10/10 runtime ACs); per-phase verification gates; executable-bit flag (test-all.sh `-perm -u+x`); no-header constraint verified; phase-7 feature-spec dependency flagged for `@pm` handoff. |
| 1.1 | 2026-07-03 | plan-writer | DoR NOT_READY fixes: (Major) Phase 4 adds `scripts/.tests/test-docs-mermaid-workflow.sh` (TC-CI-003) — executable workflow structural test so AC#2 gate-firing isn't eyeball-only; (Minors) Phase 2 scan roots exclude git-ignored `.ai/local/`; Phase 3 adds TC-RULE-004 drift-guard (script default denylist == `diagrams.md`); Phase 0 added (commit change artifacts); staging constraint corrected (pm-notes IS committed; only `.ai/local/` is git-ignored); test-scenario + AC-coverage + files-touched tables updated. |
| 1.2 | 2026-07-03 | @coder (delivery) | Open questions RESOLVED at delivery: OQ-TP-1 = REPLACE semantics (documented header lines 26-29); OQ-TP-2 = self-skipping baseline (TC-BASE-001 via `command -v mmdc`); OQ-TP-3 = 1-based block index (documented header line 21). All Phase 1–5 deliverable files authored; content-level acceptance checks PASSED via read-only grep. **Delivery mode = file-authoring-only**: `chmod`, test runs, `shellcheck`/`shfmt`, `actionlint`, `.ados-claude/` regen, and all commits are PENDING @runner/@committer/PM. Fix during authoring: `enumerate_md_files` now accepts single-file args (not only dirs) so per-file TC-MMD-009/012/RULE-004 validate correctly. |

---

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 0 | _blocked-on-pm_ | 2026-07-03 | | | Change-artifact commit owned by @committer/PM; @coder did not commit. |
| 1 | _files-authored_ | 2026-07-03 | | | diagrams.md + README row authored; content checks PASSED (grep); `test-doc-distribution.sh` run PENDING @runner. chmod N/A. |
| 2 | _files-authored_ | 2026-07-03 | | | validate-mermaid.sh authored [458 lines, DEC-7 dual check]; `chmod +x` PENDING @runner. |
| 3 | _files-authored_ | 2026-07-03 | | | test-validate-mermaid.sh authored [649 lines, TC-MMD-001..012 + TC-RULE-004 + TC-BASE-001]; `chmod +x` + run PENDING @runner. |
| 4 | _files-authored_ | 2026-07-03 | | | docs-mermaid-validate.yml + test-docs-mermaid-workflow.sh authored; ci.yml untouched; `chmod +x` + `git diff` + actionlint PENDING @runner. |
| 5 | _files-authored_ | 2026-07-03 | | | 3 agents edited (spec-writer/doc-syncer/bootstrapper); `.ados-claude/` regen PENDING @runner (DEC-2); TC-AGENT-001 content PASSED (grep). |
| 6 | _pending_ | | | | Verification phase — all gates owned by @runner; @coder hands off. |
