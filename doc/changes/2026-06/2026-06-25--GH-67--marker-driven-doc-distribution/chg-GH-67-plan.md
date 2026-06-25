---
id: chg-GH-67-marker-driven-doc-distribution
status: Updated
created: 2026-06-25T09:47:17Z
last_updated: 2026-06-25T10:14:47Z
owners: ["Juliusz Ćwiąkalski"]
service: doc-distribution
labels: ["ci", "docs", "install", "guard", "odr-0001"]
links:
  change_spec: ./chg-GH-67-spec.md
  test_plan: ./chg-GH-67-test-plan.md
  decisions:
    - ../../decisions/ODR-0001-classify-yaml-register-templates-redistributable.md
  related_changes:
    - GH-46
  benefits:
    - GH-63
    - GH-64
    - GH-65
    - GH-66
summary: >
  Replace the hand-maintained ADOS_UPDATABLE_FILES allowlist in scripts/install.sh with a
  frontmatter-marker-driven distribution system keyed by ados_distribution:
  redistributable | internal | project-generated. Install set becomes derived from markers
  (not hand-listed), templates are copied recursively (*.md + *.yaml + blueprints/**, per
  ODR-0001), and a new scripts/.tests/test-doc-distribution.sh guard fails on five drift
  conditions and runs in CI. Process and reviewer hooks (AGENTS.md, code-review-instructions.md)
  make the marker a first-class change requirement. Two same-class drive-by drift fixes to the
  install/uninstall tests are included.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-67: Marker-driven doc distribution with install-manifest drift guard

> **HARD RULE — STAGING DISCIPLINE (read before every phase commit).**
> There is an **unrelated, uncommitted change to `.ai/agent/pm-instructions.md`** sitting in the
> working tree (leftover from a prior planning session — it adds a "Reading Issue Comments" section,
> ~11 lines). This is now handled **inside Phase 4**, not ignored: it is committed FIRST as a
> SEPARATE commit with a NON-GH-67 message (the ONE exception to the GH-67 staging discipline below),
> and ONLY THEN is `pm-instructions.md` edited again for the GH-67 marker-requirement note.
>
> - ALWAYS use explicit paths: `git add <path1> <path2> ...`
> - **NEVER** use `git add -A`, `git add .`, `git add -u`, or `git add doc/`.
> - In **Phases 1–3**: **NEVER** stage `.ai/agent/pm-instructions.md` (the unrelated change is still
>   pending). In **Phase 4** it is legitimately staged — twice: (a) the prerequisite unrelated commit
>   (non-GH-67 message, that file only); (b) the GH-67 marker-note edit (alongside the other Phase-4
>   files). See Phase 4 for the exact commit sequence.
> - **NEVER** stage anything under `.ai/local/` (git-ignored ephemeral state anyway).
> - **NEVER** stage `doc/changes/**/chg-GH-67-pm-notes.yaml` as part of a delivery commit unless
>   the PM explicitly requests it (PM owns pm-notes).
> - The change folder `doc/changes/.../GH-67...` is currently **untracked**; that is expected —
>   the plan file itself is committed by `@plan-writer`, not by delivery phases.
>
> A pre-commit verification step is mandated in every phase: run `git status --short` and confirm
> ONLY the phase's intended paths are in the staged set (no `git add -A`/`.` sweep; nothing under
> `.ai/local/`).

---

## Context and Goals

This plan delivers GH-67: make the redistribution decision travel with each document via a
frontmatter marker, derive the local-install set from that marker instead of a hand-maintained
allowlist, and add a CI guard that fails on any drift — eliminating the entire class of
"redistributable doc silently not installed" omissions (the root cause of the #62 incident where
`decision-making.md` shipped but never installed).

It is a **single cohesive change**: markers (Phase 1), derived install (Phase 2), the guard
(Phase 3), and the process/CI hooks (Phase 4) all land together so the guard is green at merge.
The spec is the source of truth for all requirements, counts, and classifications — see
`./chg-GH-67-spec.md` (§8.3 classification table of 54 docs = 51 `redistributable` + 3 `internal`).

**Resolved open questions (from spec §14 + pm-notes):**

- **OQ-2 (RESOLVED, PM-decided YES):** the guard validates the marker enum. An invalid value
  (e.g. `redistibutable`, `public`) is treated like a missing marker and fails the guard. This is
  the **5th failure mode**. Rationale: RSK-6 (typo silently misclassifies) — consistency with the
  forcing-function principle.
- **OQ-1 (deferred to delivery, addressed in Phase 3):** the marker CAN be parsed reliably with
  POSIX tools given the mixed frontmatter (comment lines `# Copyright` + real keys in the
  handbook) AND the no-frontmatter `.yaml` registers. Mitigation = a bounded, **two-path**
  `get_marker()` helper (`.md` → first frontmatter block; `.yaml` → top-level key at line 1) with
  documented edge cases + self-tests (see RSK-1 / Phase 3).
- **OQ-PLAN-2 (RESOLVED, PM-decided):** `.ai/agent/pm-instructions.md` IS now edited in Phase 4.
  The unrelated pending change is committed FIRST as a separate non-GH-67 commit (Phase 4.1), then
  the marker-requirement note is added (Phase 4.4). AC-F4-1 is therefore FULLY covered.

**Open questions:**

- **OQ-PLAN-1 (resolved — test plan written):** the test plan
  (`./chg-GH-67-test-plan.md`, now written — 32 TCs, 19 ACs traced per spec §17) defines the guard's
  negative-mode fixtures and the enum-validation assertions. The guard's Phase-3 self-tests must
  align with the test plan's case matrix rather than duplicate it.

---

## Scope

### In Scope

- Apply `ados_distribution: <value>` to all 54 in-scope docs per §8.3 Tables A–E (F-1, F-5, DM-2).
- Replace hand-listed guide entries in `install.sh` with marker-driven derivation; make template
  copy recursive (`*.md` + `*.yaml` + `blueprints/**`) per ODR-0001 / DEC-1 / DEC-2 (F-2).
- Add `scripts/.tests/test-doc-distribution.sh` with five failure modes; wire into CI (F-3).
- Process hook in `AGENTS.md` + `.ai/agent/pm-instructions.md` + reviewer checklist in
  `.ai/agent/code-review-instructions.md` (F-4; both halves of AC-F4-1).
- Drive-by drift fixes: `test-install.sh` (include `decision-making.md`); `test-uninstall.sh`
  (`system-dependencies.md` → `ados-tools-system-dependencies.md`) (F-7).
- Add deferred ODR-0001 row to `doc/decisions/00-index.md`.

### Out of Scope

- [OUT] `tools/` CLI redistribution and `doc/tools/*` guides (NG-2; deferred).
- [OUT] Marking `doc/changes/**` (frozen history) and individual `doc/decisions/*` records (NG-3).
- [OUT] Applying `project-generated` markers to `AGENTS.md`, `pm-instructions.md`, `doc/spec/**`,
  `doc/overview/**` (NG-1 — remain non-distributed and unmarked).
- [OUT] The global-install path; markdown/rendering tooling; a manifest UI (NG-4/5/6).
- [OUT] Regenerating `.ados-claude/` — no `.opencode/` file is edited in this change (AC-F5-1).

### Constraints

- **NFR-3:** Only the local doc-distribution path changes; global-install behavior is untouched.
- **NFR-4:** Zero new runtime dependencies for the guard — pure POSIX (bash/git/grep/sed/awk); no
  YAML library, no `npm`/`pip`.
- **NFR-5:** Re-running `install.sh --local` on an existing project is non-destructive and
  deterministic. Install **content-syncs** updatable files (overwrites a file only when its content
  differs from the upstream ADOS reference, skips when identical) — NOT create-if-absent; templates
  are pristine references adopters copy from.
- **AC-F5-1:** No hand-added license/copyright headers anywhere; headers stay managed solely by
  `scripts/add-header-location.sh` on its configured paths. Do not fabricate headers when adding a
  marker. Note: the 50 `.md` in-scope docs already have frontmatter (the marker goes inside it); the
  4 `doc/templates/*.yaml` registers have **NO** frontmatter — there the marker is a plain top-level
  key at line 1 (see Phase 1.3), not a `---` block (which would create multi-doc YAML and break
  `yaml.safe_load()` consumers).
- **Staging discipline (HARD RULE above):** explicit-path `git add` only; never stage `.ai/local/`;
  `.ai/agent/pm-instructions.md` is staged ONLY in Phase 4 per the HARD RULE (prerequisite unrelated
  commit + the GH-67 marker-note edit).

### Risks

- **RSK-1 (M/L → L):** Marker parse fragility — mixed `.md` frontmatter (comment lines + real keys
  in the handbook) AND the no-frontmatter `.yaml` registers trip a naive parser. **Mitigation:** a
  bounded, **two-path** `get_marker()` helper — for `.md`: parse ONLY the first `---...---` block
  (skip `^#` comment lines, match a strict key pattern, ignore body/second-block occurrences); for
  `.yaml`/`.yml`: match `^ados_distribution:` as a top-level key anywhere (no `---` delimiters).
  Both return the raw value or "missing". Plus guard self-tests for the five edge cases below (four
  `.md` + one `.yaml` positive/negative pair). (Residual L.)
- **RSK-2 (M/M → L):** Guard scope too broad — scans out-of-scope dirs. **Mitigation:** scan only
  the closed DM-2 class set; assert guard passes on the current repo as-is (green baseline).
- **RSK-3 (H/L → L):** Guard scope too narrow — a new doc class escapes. **Mitigation:** derive the
  scanned set from the SAME glob roots as `install.sh`; cover all five modes in tests.
- **RSK-4 (H/L → L):** Recursive/extended glob changes install layout destructively. **Mitigation:**
  reuse the content-syncing `copy_updatable_file` primitive; mandate the AC-F6-1 idempotency test
  (deterministic content-sync, not create-if-absent).
- **RSK-6 (M/M → M):** Marker typo silently misclassifies. **Mitigation:** OQ-2 enum validation
  (5th failure mode) rejects unknown values.
- **RSK-PLAN-1 (process, M/L → L):** Staging the unrelated `pm-instructions.md` change into a GH-67
  commit. **Mitigation (now concrete):** Phase 4.1 commits the unrelated change FIRST in a separate
  non-GH-67 commit (that file only), so the subsequent GH-67 marker-note edit lands on a clean base;
  plus the HARD RULE explicit-path discipline + `git status` pre-commit verification in every phase.

### Success Metrics

| Metric | Target |
|--------|--------|
| In-scope docs carrying `ados_distribution` | 54 / 54 (100%) |
| Redistributable docs actually installed | 51 / 51 (derived == marker set) |
| Internal docs installed | 0 / 3 |
| Guard failure modes | 5 (missing-marker, redistributable-not-installed, internal-installed, derived-set drift, invalid-enum-value) |
| New external runtime deps introduced | 0 |
| Re-run of `install.sh --local` on existing project | deterministic content-sync (no uncontrolled destructive overwrites) |

---

## Phases

> Each phase = **one** Conventional Commit, staging **only** the explicit paths listed. The
> optional-env merge rule is skipped (no new packages). Phase numbering maps to the requested
> breakdown (A→1 … E→5).

### Phase 1: Apply `ados_distribution` markers to all in-scope docs

**Goal**: Make the redistribution classification travel with every in-scope document so the install
set and guard can both derive from a single source of truth.

**Tasks**:

- [x] **1.1** Add `ados_distribution: redistributable` inside the existing frontmatter of the 12
  redistributable guides (§8.3 Table A: change-lifecycle, claude-code-setup, copywriting,
  decision-making, decision-records-management, external-researcher-setup,
  meeting-preparation-and-summarization, onboarding-existing-project,
  opencode-agents-and-commands-guide, opencode-model-configuration, pr-platform-integration,
  unified-change-convention-tracker-agnostic-specification). (commit 4ec7ce7)
- [x] **1.2** Add `ados_distribution: internal` inside the existing frontmatter of the 3 internal
  guides (Table A: adding-tool-support, ados-tools-system-dependencies, tools-convention). (commit 4ec7ce7)
- [x] **1.3** Apply markers to the template set — **TWO PATHS** (the 4 `.yaml` registers have NO
  frontmatter, unlike the `.md` files — this is the CRIT-1 fix):
  - **1.3a (`.md`):** add `ados_distribution: redistributable` **inside the existing `---`-delimited
    frontmatter** of all 25 `doc/templates/*.md` (Table B) and all 5 `doc/templates/blueprints/**`
    (Table D). (commit 4ec7ce7)
  - **1.3b (`.yaml`):** the 4 `doc/templates/*.yaml` registers (Table C, per ODR-0001:
    `content-calendar-template.yaml`, `experiment-register-template.yaml`,
    `metric-catalog-template.yaml`, `product-roadmap-register-template.yaml`) start with DATA (e.g.
    `calendar_id: CONTENT-CALENDAR-001`), NOT frontmatter. Prepend `ados_distribution: redistributable`
    as the **new line 1** (a plain top-level key). Do NOT wrap it in a `---` block — a `---` block
    would create multi-doc YAML and break `yaml.safe_load()` consumers. (commit 4ec7ce7 — verified line 1)
- [x] **1.4** Add `ados_distribution: redistributable` to the 5 standalone non-guide docs (Table E):
  `doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`,
  `doc/decisions/00-index.md`, `.ai/rules/README.md`. (commit 4ec7ce7)
- [x] **1.5** Add the deferred **ODR-0001** row to `doc/decisions/00-index.md` (the decision was
  committed at c850d36 without its index entry). (commit 4ec7ce7)
- [x] **1.6** Verify count: `git grep -l 'ados_distribution:'` on the in-scope set returns exactly
  54 (51 redistributable + 3 internal). Confirm marker value distribution matches Tables A–E.
  (verified: 54 files; distribution 51 redistributable / 3 internal)
- [x] **1.7** Confirm **no** license/copyright header was hand-added. In Phase 1, `.ai/agent/pm-instructions.md`
  is NOT staged (the unrelated change stays pending until Phase 4.1). (verified: only ados_distribution: lines + 1 ODR-0001 table row inserted; pm-instructions.md left unstaged)

**Acceptance Criteria**:

- Must: AC-F1-1 (15 guides: 12 redistributable + 3 internal, matching Table A).
- Must: AC-F1-2 (25 `*.md` + 4 `*.yaml` + 5 blueprints all `redistributable`).
- Must: AC-F1-3 (5 standalone docs all `redistributable`).
- Should: marker inserted as a single key line; no content/reformatting churn beyond the key. For
  `.md` it lives inside the existing frontmatter; for the 4 `.yaml` registers it is a new line 1.

**Files and modules**:

- `doc/guides/*.md` (15 files) — updated
- `doc/templates/*.md` (25) + `doc/templates/*.yaml` (4) + `doc/templates/blueprints/*` (5) — updated
- `doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`,
  `doc/decisions/00-index.md`, `.ai/rules/README.md` — updated

**Stage ONLY**:

```
git add doc/guides/*.md \
  doc/templates/*.md doc/templates/*.yaml doc/templates/blueprints/*.md \
  doc/documentation-handbook.md doc/00-index.md \
  doc/decisions/README.md doc/decisions/00-index.md \
  .ai/rules/README.md
```

**Tests**:

- `git grep -c 'ados_distribution:' <in-scope files>` ≥ 1 each; total == 54.
- Spot-check the handbook (mixed frontmatter) parses cleanly under the Phase-3 `get_marker()` helper.

**Completion signal**: `docs(GH-67): apply ados_distribution markers to all in-scope docs`

---

### Phase 2: Refactor `install.sh` — derive install set from markers; recurse templates

**Goal**: Remove the hand-list drift surface — the local guide install set is derived from the
marker, and templates are copied recursively so blueprints and the 4 YAML registers install.

**Tasks**:

- [x] **2.1** Add a `get_marker()` POSIX helper that mirrors the guard's **two-path** parser
  EXACTLY (see Phase 3.1) and returns the `ados_distribution` value for a doc: for `.md` parse the
  first `---...---` frontmatter block; for `.yaml`/`.yml` match `^ados_distribution:` as a
  top-level key. Both return the raw value or "missing". (commit 57fae30; verified on real repo files)
- [x] **2.2** In `install_local_files()`, replace the guide entries from
  `ADOS_UPDATABLE_FILES` (manifest L82–93) with marker-driven globbing over `doc/guides/*.md`:
  install a guide **only if** `get_marker` returns `redistributable`. (commit 57fae30; smoke test: 12 install, 3 internal skipped)
- [x] **2.3** Keep the standalone non-guide entries (handbook, `doc/00-index.md`, decision stubs,
  `.ai/rules/README.md`) explicit (they live outside the globbed classes) — they are already
  `redistributable`-marked and are marker-checked by the Phase-3 guard. (commit 57fae30)
- [x] **2.4** Make the template copy **recursive**: replace the single
  `for tmpl_file in "${source_dir}/${ADOS_TEMPLATE_DIR}"/*.md` loop (L677) with globs over
  `*.md`, `*.yaml`, and `blueprints/**` (use `shopt -s globstar nullglob` or an explicit find), so
  blueprints and the 4 YAML registers install. Preserve relative paths under `doc/templates/`. (commit 57fae30; smoke: 4 yaml + 5 blueprints, paths preserved)
- [x] **2.5** Keep using the `copy_updatable_file` primitive for every copied file. It
  **content-syncs** updatable files (overwrites a file when its content differs from the upstream
  ADOS reference, skips when identical) — templates are pristine references adopters copy from, so
  content-sync is the intended behavior (NO change to install behavior — MAJ-3). Satisfies NFR-5 /
  AC-F6-1. (commit 57fae30; reused primitive unchanged)
- [x] **2.6** In Phase 2, `.ai/agent/pm-instructions.md` is NOT staged (the unrelated change stays
  pending until Phase 4.1). (verified: only scripts/install.sh staged)

**Acceptance Criteria**:

- Must: AC-F2-1 (installed guide set == the 12 `redistributable`-marked guides; hand-list no longer
  authoritative).
- Must: AC-F2-2 (templates copied recursively — `*.md` AND `*.yaml` AND `blueprints/**`; per DEC-1/DEC-2).
- Must: AC-F2-3 (the 3 `internal` guides never install).
- Must: AC-F2-4 (`decision-making.md` + `decision-records-management.md` both install, closing #62).
- Must: AC-F6-1 (re-run is non-destructive and deterministic — content-sync, verified in Phase 5).
- Should: stale-manifest-entry tolerance (existing warn-and-skip at L663–664) preserved.

**Files and modules**:

- `scripts/install.sh` — updated (manifest guide entries removed; `get_marker` helper added;
  `install_local_files()` template loop made recursive).

**Stage ONLY**:

```
git add scripts/install.sh
```

**Tests**:

- `bash scripts/.tests/test-install.sh` (updated in Phase 3 to assert blueprints + yaml install and
  `decision-making.md` present).
- Local smoke: `install.sh --local` into a temp project; diff shows blueprints/, `*.yaml` registers,
  and `decision-making.md` present; internal guides absent.

**Completion signal**: `feat(GH-67): derive doc install set from ados_distribution markers; recurse templates`

---

### Phase 3: Doc-distribution drift guard + drive-by install/uninstall test fixes

**Goal**: The forcing function — a deterministic, dependency-free guard that fails on five drift
conditions, plus the two same-class drive-by test fixes.

**Tasks**:

- [x] **3.1** Create `scripts/.tests/test-doc-distribution.sh` implementing a single `get_marker()`
  POSIX parser (no YAML lib — NFR-4) shared conceptually with `install.sh`. **Parse rule is
  EXTENSION-AWARE (two-path) — the CRIT-1 fix:** (commit 005472e; mirrors install.sh get_marker exactly)
  - **`.md` files:** frontmatter = the text between the `---` on line 1 (must be the very first
    line) and the next `---`. Within that FIRST block only, match a line of the form
    `^ados_distribution:[ \t]*(.+)$` and capture the trimmed value; **skip** `^#` comment lines and
    **ignore** any occurrence in the body or in a second `---` block.
  - **`.yaml` / `.yml` files:** match `^ados_distribution:` as a top-level key anywhere in the file
    (NO `---` delimiters — these registers have no frontmatter; a `---` block would create multi-doc
    YAML and break `yaml.safe_load()` consumers).
  - Both paths return the raw value, or "missing" if absent / no frontmatter block.
- [x] **3.2** Implement the **five failure modes** (4 ticket + enum validation, per OQ-2):
  (commit 005472e; all 5 negative modes verified to fire via temporary injection)
  1. **missing-marker** — any in-scope doc (DM-2 classes) with no marker ⇒ FAIL (AC-F1-4).
  2. **invalid-enum-value** — marker value not in `{redistributable, internal, project-generated}` ⇒
     FAIL (treat like missing; RSK-6/OQ-2).
  3. **redistributable-not-installed** — a `redistributable` doc not in the install-derived set ⇒
     FAIL (AC-F3-1).
  4. **internal-installed** — an `internal` doc present in the install set ⇒ FAIL (AC-F3-2).
  5. **derived-set drift** — install-derived set ≠ marker-derived set ⇒ FAIL (AC-F3-3).
- [x] **3.3** Scan **only** the DM-2 class set: `doc/guides/*.md`, `doc/templates/*.md`,
  `doc/templates/*.yaml`, `doc/templates/blueprints/**`, `doc/documentation-handbook.md`,
  `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`.
  Must NOT scan `doc/changes/**`, `doc/spec/**`, `doc/overview/**`, individual `doc/decisions/*`
  records, or `AGENTS.md` (AC-F3-4, RSK-2). (commit 005472e; closed set enumerated explicitly)
- [x] **3.4** Derive the install set with the SAME glob roots/logic as `install.sh` (RSK-3).
  (commit 005472e; expected set mirrors install.sh guide/template/standalone rule)
- [x] **3.5** Include guard **self-tests** for the `get_marker()` edge cases (RSK-1 / OQ-1) — four
  `.md` cases plus one `.yaml` positive/negative pair (five total — the 5th is the CRIT-1 addition):
  (commit 005472e; 7 sub-cases: 4 .md + yaml positive/negative/indented)
  - `.md` no-frontmatter doc → no marker (none);
  - `.md` body contains the literal `ados_distribution:` string (e.g. in a code fence) → not matched;
  - `.md` commented-out marker line (`# ados_distribution: redistributable`) → not matched;
  - `.md` marker present only in a second/`---` block → not matched (first block only);
  - `.yaml` top-level key present → matched (positive); `.yaml` with the key absent → "missing"
    (negative) — exercises the second parser path.
- [x] **3.6** Emit human- + machine-readable failure messages naming the file and the failed mode;
  use `::error::` GitHub annotations where supported (spec §10). Ensure determinism (NFR-1) and
  wall-clock < 5 s with no network (NFR-2). (commit 005472e; ::error:: annotations + named modes; offline sandbox)
- [x] **3.7** UPDATE `scripts/.tests/test-install.sh`: include `decision-making.md` in the mock ADOS
  source AND in the guide assertions (AC-F7-1); add assertions that `blueprints/` and the
  `*.yaml` registers now install; assert idempotency via **content-sync** (re-running produces an
  identical, deterministic result — overwrites only when content differs, NOT create-if-absent).
  (commit 005472e; mock guides carry markers; +2 tests, 49/49 pass)
- [x] **3.8** FIX `scripts/.tests/test-uninstall.sh`: replace stale fixture `system-dependencies.md`
  with `ados-tools-system-dependencies.md` (AC-F7-2). (commit 005472e; also renamed the matching
  stale entry in scripts/uninstall.sh — necessary so the renamed fixture is actually removed; 29/29 pass)
- [x] **3.9** In Phase 3, `.ai/agent/pm-instructions.md` is NOT staged (the unrelated change stays
  pending until Phase 4.1). (verified: staged set is the 3 test files + uninstall.sh)

**Acceptance Criteria**:

- Must: AC-F1-4 (missing-marker fails, naming the file).
- Must: AC-F3-1 / AC-F3-2 / AC-F3-3 (the three drift modes).
- Must: AC-F3-4 (templates scanned across `*.md` + `*.yaml` + `blueprints/**`).
- Must: OQ-2 / RSK-6 (invalid enum value fails).
- Must: AC-F7-1 / AC-F7-2 (the two drive-by fixes).
- Should: guard passes on the current repo as the green baseline (RSK-2 confirmation).

**Files and modules**:

- `scripts/.tests/test-doc-distribution.sh` — new (the guard)
- `scripts/.tests/test-install.sh` — updated (decision-making.md, blueprints, yaml, idempotency)
- `scripts/.tests/test-uninstall.sh` — updated (stale fixture rename)

**Stage ONLY**:

```
git add scripts/.tests/test-doc-distribution.sh scripts/.tests/test-install.sh scripts/.tests/test-uninstall.sh
```

**Tests**:

- The guard IS the test; run `bash scripts/.tests/test-doc-distribution.sh` and expect PASS on the
  green baseline. (Negative-mode coverage — inject a synthetic broken doc in a temp tree — to be
  finalized per the test plan.)

**Completion signal**: `test(GH-67): add doc-distribution drift guard; fix install/uninstall test fixtures`

---

### Phase 4: CI wiring + process/reviewer hooks

**Goal**: Wire the guard into CI as a merge gate, and encode the marker requirement in the process
and review surfaces that did not exist for #62. The unrelated `pm-instructions.md` change is landed
FIRST (clean base), then the GH-67 marker note is added — so BOTH halves of AC-F4-1 are satisfied.

**Tasks**:

- [x] **4.1 (PREREQUISITE — do FIRST):** commit the **unrelated, already-uncommitted** change to
  `.ai/agent/pm-instructions.md` (it adds a "Reading Issue Comments" section, ~11 lines, sitting in
  the working tree) as a **SEPARATE commit with a NON-GH-67 message**, e.g.
  `docs(pm): document gh CLI for reading issue comments`. Stage **ONLY**
  `.ai/agent/pm-instructions.md`. This is the ONE exception to the GH-67 staging discipline: a
  standalone commit, non-GH-67 message, that single file. It must land BEFORE 4.4 so the marker-note
  edit applies to a clean file. (commit a25e5ab — verified diff = Reading Issue Comments section only)
- [x] **4.2** `.github/workflows/ci.yml`: add a step that runs `bash scripts/.tests/test-doc-distribution.sh`
  alongside the existing `.ados-claude/` idempotency check (replaces/uses the `# Future: Add
  additional quality gates here` placeholder). A non-zero guard exit blocks merge (AC-F3-5).
  (commit 8f74e30 — new 'doc-distribution-guard' job; YAML parses)
- [x] **4.3** `AGENTS.md`: document that any new/changed doc under `doc/` MUST declare
  `ados_distribution`, and that a change introducing a redistributable doc MUST pass
  `test-doc-distribution.sh` (AC-F4-1 — the `AGENTS.md` half). (commit 8f74e30 — 'Doc distribution marker' subsection)
- [x] **4.4** `.ai/agent/pm-instructions.md`: add a SHORT note (same substance as 4.3) that any
  new/changed doc under `doc/` MUST declare `ados_distribution`, and that redistributable docs MUST
  pass `scripts/.tests/test-doc-distribution.sh`. This is the `pm-instructions.md` half of AC-F4-1
  (the ticket explicitly requires BOTH `AGENTS.md` AND `pm-instructions.md`). This is the MAJ-2 fix.
  (commit 8f74e30 — added on the clean base from 4.1)
- [x] **4.5** `.ai/agent/code-review-instructions.md`: add a checklist item requiring verification of
  the `ados_distribution` marker (present + correct) for new/changed docs under
  `doc/guides|templates` or the handbook, and confirmation that the guard passes when the doc is
  `redistributable` (AC-F4-2). (commit 8f74e30 — Documentation checklist item)
- [x] **4.6** Confirm ONLY the intended Phase-4 paths are staged; nothing under `.ai/local/`.
  (verified: 4 files staged; 0 under .ai/local/)

**Acceptance Criteria**:

- Must: AC-F3-5 (CI runs the guard; failure blocks merge).
- Must: AC-F4-2 (reviewer checklist item present and correct).
- Must: AC-F4-1 — **FULL**: both the `AGENTS.md` half (4.3) and the `pm-instructions.md` half (4.4)
  are delivered; the prerequisite unrelated commit in 4.1 made the file clean first.
- Should: the marker-requirement note links to the guard and the classification table for discoverability.

**Files and modules**:

- `.ai/agent/pm-instructions.md` — committed as a SEPARATE non-GH-67 commit in 4.1 (the unrelated
  change), THEN edited for the GH-67 marker note in 4.4
- `.github/workflows/ci.yml` — updated (new step)
- `AGENTS.md` — updated (marker-requirement process note)
- `.ai/agent/code-review-instructions.md` — updated (checklist item)

**Stage ONLY** (two commits — see HARD RULE):

Commit 1 (4.1, prerequisite, non-GH-67 message):

```
git add .ai/agent/pm-instructions.md
# commit message: docs(pm): document gh CLI for reading issue comments
```

Commit 2 (4.2–4.6, the GH-67 phase commit):

```
git add .github/workflows/ci.yml AGENTS.md .ai/agent/code-review-instructions.md .ai/agent/pm-instructions.md
```

**Tests**:

- Run the CI step locally: `bash scripts/.tests/test-doc-distribution.sh` exits 0.
- Grep `AGENTS.md`, `.ai/agent/pm-instructions.md`, and `.ai/agent/code-review-instructions.md` for
  the marker-requirement / checklist wording.

**Completion signal**: `ci(GH-67): wire doc-distribution guard; document marker requirement in AGENTS.md + pm-instructions.md + reviewer checklist`

---

### Phase 5: Verification & quality gates

**Goal**: Prove the change is green end-to-end and satisfies header hygiene / idempotency before
handing to downstream lifecycle phases (doc-sync → review → DoD → PR). This phase produces **no
code commit** unless a regression is found (in which case a targeted `fix`/`test` commit follows).

**Tasks**:

- [x] **5.1** Run all relevant test files and confirm PASS:
  `bash scripts/.tests/test-doc-distribution.sh`,
  `bash scripts/.tests/test-install.sh`,
  `bash scripts/.tests/test-uninstall.sh`,
  `bash scripts/.tests/test-add-header-location.sh` (no regression),
  `bash scripts/.tests/test-build-claude-plugin.sh` (no regression).
  (PASS: guard exit 0 / 54 docs; test-install 49/49; test-uninstall 29/29; add-header 19/19; build-claude 15/15)
- [x] **5.2** Verify the guard passes on the current repo as the green baseline (RSK-2).
  (verified: guard exit 0, "no drift — 54 in-scope docs")
- [x] **5.3** Idempotency check (AC-F6-1, content-sync): run `install.sh --local` twice into a
  scratch project; assert the second run produces an **identical, deterministic result** (content-sync:
  overwrites a file only when its content differs from upstream, skips when identical). This is
  content-sync (the live behavior), NOT create-if-absent — the test verifies determinism, not
  "diff = additive only". (verified: scratch install twice → identical 51-file tree; covered by test_local_install_idempotent_content_sync)
- [x] **5.4** Header hygiene (AC-F5-1): confirm no hand-added license/copyright headers were
  introduced; headers on configured paths remain the sole responsibility of
  `scripts/add-header-location.sh`. (verified: guard file has no Copyright header; no Copyright lines in committed diffs)
- [x] **5.5** `.ados-claude/` check: since NO `.opencode/` file was edited, do NOT regenerate the
  plugin. Run `bash scripts/.tests/test-build-claude-plugin.sh` only to confirm the generated plugin
  is still current (no drift). (verified: 0 .opencode/ + 0 .ados-claude/ changes; build-claude test 15/15; regeneration produced no diff)
- [x] **5.6** Staging final check: `git status --short` shows the working tree clean of GH-67 paths;
  `.ai/agent/pm-instructions.md` is committed in the two Phase-4 commits (unrelated note 4.1 + GH-67
  marker note 4.4) and nothing stray is staged. (verified: only chg-GH-67-plan.md + pm-notes.yaml unstaged — PM-owned)
- [x] **5.7** Hand off: signal completion for `system_spec_update` (lifecycle phase 6). For this
  change, `doc/spec/**` does not need a new feature entry — the marker is process/install mechanics
  and `AGENTS.md` (updated in Phase 4) is the de-facto process spec. `@doc-syncer` confirms. (noted — handoff to doc-syncer)
- [x] **5.8 (PR note, MAJ-3):** when `@pr-manager` opens the PR, the description MUST flag the
  **copy-from-template convention** for adopters: templates are pristine references and `install.sh`
  content-syncs (overwrites when content differs) — adopters copy from templates into their own
  project-specific files rather than editing the installed references in place. (noted for @pr-manager)

**Acceptance Criteria**:

- Must: AC-F5-1 (no hand-added headers; `.ados-claude/` untouched / current).
- Must: AC-F6-1 (idempotent, non-destructive, deterministic content-sync re-run).
- Should: all 19 ACs demonstrably covered (see AC coverage map below).

**Files and modules**:

- None committed by default. (A regression fix, if needed, gets its own targeted commit with
  explicit-path staging.)

**Stage ONLY**: (none — verification phase)

**Tests**:

- All five `.tests/` runs above are the verification.

**Completion signal**: No commit (green baseline). Downstream: `@doc-syncer` → `@reviewer` (red-team
rounds RT1/RT2 per pm-notes) → `@runner` quality gates → `@pm` DoD → `@pr-manager` PR.

---

## Test Scenarios

> Precise case IDs and fixtures will be finalized in `./chg-GH-67-test-plan.md`. This table maps the
> scenario classes to phases and acceptance criteria.

| ID | Scenario | Phases | AC |
|----|----------|:-----:|----|
| TS-1 | All 54 in-scope docs carry a valid marker (12/3 guide split, 34 templates, 5 standalone) | 1 | AC-F1-1, AC-F1-2, AC-F1-3 |
| TS-2 | A guide with no marker fails the guard (missing-marker) | 3 | AC-F1-4 |
| TS-3 | A guide with an invalid enum value fails (invalid-enum-value) | 3 | OQ-2, RSK-6 |
| TS-4 | A `redistributable` doc absent from the install set fails (redistributable-not-installed) | 3 | AC-F3-1 |
| TS-5 | An `internal` doc present in the install set fails (internal-installed) | 3 | AC-F3-2 |
| TS-6 | Install-derived set ≠ marker-derived set fails (derived-set drift) | 3 | AC-F3-3 |
| TS-7 | `get_marker()` edge cases (.md: no-frontmatter, body-string, commented line, second block; .yaml: top-level key present/absent) | 3 | RSK-1, OQ-1 |
| TS-8 | Local install derives the 12 redistributable guides (hand-list removed) | 2, 5 | AC-F2-1 |
| TS-9 | Templates install recursively: blueprints + 4 yaml registers | 2, 5 | AC-F2-2, AC-F3-4 |
| TS-10 | 3 internal guides never install | 2, 5 | AC-F2-3 |
| TS-11 | `decision-making.md` + `decision-records-management.md` install (#62 fix) | 2, 5 | AC-F2-4 |
| TS-12 | Re-run `install.sh --local` is deterministic / non-destructive (content-sync) | 5 | AC-F6-1 |
| TS-13 | CI runs the guard; failure blocks merge | 4 | AC-F3-5 |
| TS-14 | `AGENTS.md` + `pm-instructions.md` both state the marker requirement | 4 | AC-F4-1 |
| TS-15 | Reviewer checklist covers the marker for guide/template/handbook docs | 4 | AC-F4-2 |
| TS-16 | `test-install.sh` mock + assertions include `decision-making.md`, blueprints, yaml, idempotency | 3 | AC-F7-1 |
| TS-17 | `test-uninstall.sh` uses `ados-tools-system-dependencies.md` fixture | 3 | AC-F7-2 |
| TS-18 | No hand-added license headers; `.ados-claude/` not regenerated | 1, 5 | AC-F5-1 |

---

## AC Coverage Map

| AC | Phase(s) | Status |
|----|:--------:|--------|
| AC-F1-1 (15 guides: 12 redist + 3 internal) | 1 | ✅ Covered |
| AC-F1-2 (25 md + 4 yaml + 5 blueprints redist) | 1 | ✅ Covered |
| AC-F1-3 (5 standalone docs redist) | 1 | ✅ Covered |
| AC-F1-4 (missing-marker fails) | 3 | ✅ Covered |
| AC-F2-1 (guide set derived from markers) | 2, 5 | ✅ Covered |
| AC-F2-2 (recursive templates: md + yaml + blueprints) | 2, 5 | ✅ Covered |
| AC-F2-3 (3 internal guides never install) | 2, 5 | ✅ Covered |
| AC-F2-4 (decision-making + decision-records install) | 2, 5 | ✅ Covered |
| AC-F3-1 (redistributable-not-installed fails) | 3 | ✅ Covered |
| AC-F3-2 (internal-installed fails) | 3 | ✅ Covered |
| AC-F3-3 (derived-set drift fails) | 3 | ✅ Covered |
| AC-F3-4 (guard scans md + yaml + blueprints) | 3 | ✅ Covered |
| AC-F3-5 (CI runs guard; blocks merge) | 4 | ✅ Covered |
| AC-F4-1 (AGENTS.md + pm-instructions.md state requirement) | 4 | ✅ Covered |
| AC-F4-2 (reviewer checklist item) | 4 | ✅ Covered |
| AC-F6-1 (idempotent, non-destructive, deterministic content-sync re-run) | 5 | ✅ Covered |
| AC-F5-1 (no hand-added headers; .ados-claude current) | 1, 5 | ✅ Covered |
| AC-F7-1 (test-install.sh includes decision-making.md) | 3 | ✅ Covered |
| AC-F7-2 (test-uninstall.sh fixture rename) | 3 | ✅ Covered |

**Coverage: 19 / 19 fully covered.** (Spec §17 enumerates 19 ACs — the table above lists 19 rows.
The prior AC-F4-1 PARTIAL is now FULL via the MAJ-2 fix: the unrelated `pm-instructions.md` change
is committed first as a separate non-GH-67 commit in Phase 4.1, then the GH-67 marker note is added
in Phase 4.4, so BOTH `AGENTS.md` and `pm-instructions.md` carry the requirement.)

---

## Flagged Items

- **F-1 (RESOLVED — AC-F4-1 now FULL):** `.ai/agent/pm-instructions.md` had an unrelated,
  uncommitted change in the working tree. **PM decision (apply as fact):** land the unrelated change
  FIRST as a separate non-GH-67 commit (Phase 4.1: `docs(pm): document gh CLI for reading issue
  comments`, that file only), then add the GH-67 marker-requirement note in Phase 4.4. AC-F4-1 is
  therefore fully satisfied by BOTH `AGENTS.md` (4.3) and `pm-instructions.md` (4.4).
- **F-2 (OQ-1 parsing risk — delivery-time feasibility):** the `get_marker()` POSIX parser is the
  single highest-risk component (RSK-1). Mitigation is baked into Phase 3 (two-path parse: `.md`
  first-block; `.yaml` top-level key + five edge-case self-tests). If feasibility fails in delivery,
  fall back to a tighter spec (require the marker on a dedicated line immediately after the
  `source:` line) — but the audit suggests the generic two-path parser is sufficient.
- **F-3 (RESOLVED — test plan written):** `./chg-GH-67-test-plan.md` is now written (32 TCs, 19 ACs
  traced per spec §17). Coordinate so the guard's Phase-3 self-tests and the test plan's case matrix
  align rather than duplicate.
- **F-4 (Version bump — N/A for this repo):** `version_impact: minor` is informational. This is a
  template/framework repo with **no SemVer file** (no `package.json`/`VERSION`). Per repo convention
  there is no version artifact to bump; the "release" of this change is the merged PR + the
  content-sync install behavior on the next `install.sh --local` run by adopters. Addressed here
  explicitly per plan authoring rules.
- **F-5 (Spec reconciliation — lifecycle phase 6):** `doc/spec/**` needs no new entry (the marker is
  process/install mechanics); `AGENTS.md` (Phase 4) carries the process-spec update. `@doc-syncer`
  confirms in Phase 5 / lifecycle phase 6.
- **F-6 (Red-team cadence, from pm-notes):** two red-team rounds are requested — RT1 after artifacts
  (spec/plan/test-plan) and RT2 after delivery. Both occur in the `review_fix` lifecycle phase, not
  in delivery phases.

---

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-67-spec.md | Spec (source of truth) |
| Implementation plan | ./chg-GH-67-plan.md | Plan (this file) |
| Test plan | ./chg-GH-67-test-plan.md | Test plan (pending) |
| PM notes | ./chg-GH-67-pm-notes.yaml | PM state |
| ODR-0001 (yaml registers = redistributable) | ../../decisions/ODR-0001-classify-yaml-register-templates-redistributable.md | Decision (Accepted, c850d36) |
| Related change | GH-46 / PR #62 (decision-making.md) | Related |
| Beneficiaries (blocked-on correct) | GH-63, GH-64, GH-65, GH-66 | Benefits |

**Files touched by delivery (summary):**

| Path | Phase | New/Updated |
|------|:-----:|:-----------:|
| `doc/guides/*.md` (15) | 1 | updated |
| `doc/templates/*.md` (25), `*.yaml` (4), `blueprints/*` (5) | 1 | updated |
| `doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md` | 1 | updated |
| `scripts/install.sh` | 2 | updated |
| `scripts/.tests/test-doc-distribution.sh` | 3 | new |
| `scripts/.tests/test-install.sh` | 3 | updated |
| `scripts/.tests/test-uninstall.sh` | 3 | updated |
| `.github/workflows/ci.yml` | 4 | updated |
| `AGENTS.md` | 4 | updated |
| `.ai/agent/code-review-instructions.md` | 4 | updated |
| `.ai/agent/pm-instructions.md` | 4 | updated (unrelated "Reading Issue Comments" change committed as a SEPARATE non-GH-67 commit in 4.1; GH-67 marker-requirement note added in 4.4) |
| `.ados-claude/` | — | **NOT regenerated (no `.opencode/` change)** |

---

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | plan-writer | Initial plan: 5 phases (A–E), AC coverage map, hard staging rule, OQ-1/OQ-2 resolutions, pm-instructions.md flagged for PM reconciliation |
| 1.1 | 2026-06-25 | plan-writer | Red-team RT1 revisions: CRIT-1 — two-path parser + `.yaml` marker at line 1 (Phase 1.3, 2.1, 3.1, 3.5); MAJ-2 — resolve F-1/AC-F4-1 (Phase 4 prerequisite unrelated commit + marker note in pm-instructions.md) → FULL; MAJ-3 — install = content-sync (not create-if-absent) + PR copy-from-template note; MAJ-4 — AC count 18→19, coverage 17/18→19/19 |

---

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Done | 2026-06-25 | 2026-06-25 | 4ec7ce7 | Marker application (54 docs) — 51 redistributable + 3 internal; ODR-0001 row added |
| 2 | Done | 2026-06-25 | 2026-06-25 | 57fae30 | install.sh marker derivation + recursive templates (12 guides, 4 yaml, 5 blueprints) |
| 3 | Done | 2026-06-25 | 2026-06-25 | 005472e | Guard (5 modes, all verified) + drive-by install/uninstall test fixes (+uninstall.sh stale entry) |
| 4 | Done | 2026-06-25 | 2026-06-25 | a25e5ab + 8f74e30 | CI + process/reviewer hooks (unrelated pm-instructions.md committed first as non-GH-67 a25e5ab; then GH-67 marker note 8f74e30) |
| 5 | Done | 2026-06-25 | 2026-06-25 | (no commit) | Verification — all 5 test suites green; idempotency + header hygiene + .ados-claude currency confirmed |
