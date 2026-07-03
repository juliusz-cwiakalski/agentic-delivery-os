---
id: chg-GH-112-post-bulk-edit-verify-rule
status: Updated
created: 2026-07-03T03:15:00Z
last_updated: 2026-07-03T04:45:00Z
owners: ["Juliusz Ćwiąkalski"]
service: ai-rules
labels: ["rules", "agents", "doc-distribution", "guard"]
links:
  change_spec: ./chg-GH-112-spec.md
  epic: "#107"
  related_changes: ["#115"]
  feature_specs:
    - doc/spec/features/feature-doc-distribution-marker.md
    - doc/spec/features/feature-license-header-script.md
    - doc/spec/features/feature-claude-plugin-generation.md
summary: >
  Add a new standalone rule `.ai/rules/bulk-edit-verify.md` that makes
  post-bulk-edit verification a mandatory, loadable implementation rule:
  a trigger (any multi-file edit / regex/sed/replaceAll substitution /
  find-and-replace over a glob), a three-part verify-before-commit MUST gate
  (diff-stat + targeted grep including a substring-overlap check + typecheck/
  compile), and a clean-revert recovery contract (revert + re-apply, never
  in-place counter-edits). Wire it into the README index and the `@coder` /
  `@pm` rule-load sections,   regenerate the `.ados-claude/` mirrors, and make
  its `redistributable` marker distribution-truthful (header via the sanctioned
  script + `ADOS_UPDATABLE_FILES` entry + uninstall `ADOS_LOCAL_STANDALONE_DOCS`
  entry + drift-guard `STANDALONE_DOCS` entry — three hand-synced lists, NFR-4
  list-triple sync).
version_impact: patch
---

# IMPLEMENTATION PLAN — GH-112: Post-bulk-edit verify rule (grep/diff verify before commit)

## Context and Goals

This plan delivers **GH-112**: a codified, loadable implementation rule that requires every implementation agent to **verify** (diff-stat + targeted grep **including a substring-overlap check** + typecheck/compile gate) the result of any bulk/tree-wide edit **before committing**, and to follow a **clean-revert recovery contract** if collateral damage is found.

Today the verify step exists only as ad-hoc agent behavior. During a prior delivery, an agent ran a global `sed` substitution whose pattern overlapped a package-declaration substring and catastrophically rewrote a package path across `src/` — caught **only** because the agent performed an organic post-edit grep verify. GH-112 turns that organic step into a standing rule so a future agent cannot omit it.

The change is **additive**: one new rule file, one README index row, two agent load-references, regenerated generated-plugin mirrors, and distribution wiring (one installer entry + one drift-guard entry + canonical header). It connects to the broader safety theme (epic #107 drift detection & gate enforcement; one-way cross-link to #115 large-artifact authoring policy).

**Resolved decisions carried from the spec (treated as settled, not re-litigated):**

- **DEC-1** — The new rule mirrors `.ai/rules/README.md` end-to-end: canonical header (via the sanctioned script) + `ados_distribution: redistributable` marker + `ADOS_UPDATABLE_FILES` entry + `ADOS_LOCAL_STANDALONE_DOCS` entry + `STANDALONE_DOCS` entry (install + uninstall + guard; DM-2/DM-4/DM-3). `.ai/rules/README.md` is present in all three lists, so the mirror must be too — otherwise `uninstall.sh --local` leaves the rule orphaned in every adopting project that later uninstalls/upgrades (contradicts G-5 distribution truthfulness). A bare `redistributable` marker on an uninstalled file would fail drift-guard mode 3 — exactly the drift the GH-67 guard prevents. This is why ticket AC #4 (marker + header) expands into AC-F6-1..6.
- **DEC-2** — The rule is a new standalone file `.ai/rules/bulk-edit-verify.md` (the issue's "fold into `naming-and-types.md`" option is moot: no such file exists).
- **DEC-3** — Baseline agent load-set = `@coder` + `@pm` (when it implements directly) + README index. `@fixer` is deferred (OQ-1). `@reviewer` already auto-loads `.ai/rules/` via its pre-flight (reviewer.md lines 118 & 144) — no reviewer change needed.

**Open questions (non-blocking):**

- **OQ-1 (deferred)**: Should `@fixer` also load the rule? `@fixer` applies edits and is exposed to the same substring-overlap hazard. Out of scope for GH-112 baseline; revisit as a small follow-up. Decision needed: consult `@decision-advisor` if scope is expanded.
- **OQ-2 (advisory)**: No `doc/spec/features/feature-ai-rules.md` documents the `.ai/rules/` catalog/distribution. Advisory coverage gap — **not** a delivery blocker; re-surfaced at system_spec_update by `@doc-syncer`'s `spec_coverage_gaps` field. Human decides whether a follow-up spec ticket is warranted.

## Scope

### In Scope

- New rule file `.ai/rules/bulk-edit-verify.md` with the four content sections: **trigger** (F-1), **three-part verify-before-commit MUST gate** (F-2), **substring-overlap pre/post check** (F-3), **clean-revert recovery contract** (F-4), plus the one-way `#115` cross-link (F-1-2).
- Distribution wiring (F-6): canonical header via `scripts/add-header-location.sh`, `ados_distribution: redistributable` marker, one identical entry in each of the **three** hand-synced lists — `scripts/install.sh` `ADOS_UPDATABLE_FILES`, `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS`, and `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS` (NFR-4 list-triple sync).
- Discovery & loading (F-5): one new row in `.ai/rules/README.md` index table; one load-reference in `.opencode/agent/coder.md`; one load-reference in `.opencode/agent/pm.md` (for when PM implements directly).
- Regenerated `.ados-claude/agents/*.md` mirrors committed **together** with the `.opencode/agent/` source edits (NFR-5).

### Out of Scope

- [OUT] Banning or restricting global `sed`/bulk-edit tools (NG-1).
- [OUT] A general AST-aware refactor tool (NG-2).
- [OUT] Cleaning up the inconsistent header/marker status of existing rule files (`bash.md`, `installer.md`, `testing-strategy.md`) — NG-3. Only the **new** rule mirrors the README pattern.
- [OUT] A runtime/hard gate that mechanically enforces the verify step — it remains a prompt-level rule (NG-4).
- [OUT] Creating `doc/spec/features/feature-ai-rules.md` (advisory gap, OQ-2).
- [OUT] Loading the rule in `@fixer` (deferred, OQ-1) or any dedicated `@reviewer` change (it auto-loads `.ai/rules/`).

### Constraints

- **Headers via the sanctioned script only.** Per AGENTS.md, AI agents must **never** add license headers by hand; the canonical 3-line header is injected by `scripts/add-header-location.sh`. The new rule's frontmatter is therefore authored with the **marker only**; the header is applied by the script (Phase 2), which **preserves** the `ados_distribution` marker (its `ensure_basic_header` awk classifies non-header lines into `other[]` and re-emits them in place).
- **`.ados-claude/**` is generated.** Never hand-edit; regenerate via `scripts/build-claude-plugin.sh` and commit the mirrors together with the source edits.
- **MUST phrasing.** The verify gate and recovery contract are phrased as **MUST** (imperative), not SHOULD/MAY (issue note, NFR-1).
- **List-triple synchronization.** `ADOS_UPDATABLE_FILES` (install), `ADOS_LOCAL_STANDALONE_DOCS` (uninstall), and `STANDALONE_DOCS` (guard) are **three** independent hand-synced copies (ODR-0001); the **identical** string `.ai/rules/bulk-edit-verify.md` is appended to all three (NFR-4 list-triple). Guard mode 5 backstops the install↔guard pair only — the uninstall list is **not** guard-observed (mode 5 compares the marker-derived set vs the sandbox install set), so uninstall drift is invisible to CI and is backstopped by the Phase-2 3-way byte-identity diff plus the uninstall list's own `# MUST stay in sync` comment invariant (DM-4 / AC-F6-6).
- **Header script default paths exclude `.ai/rules/`.** The script must be invoked **explicitly on the file**: `scripts/add-header-location.sh .ai/rules/bulk-edit-verify.md` (its `process_path` handles a single `.md` path argument).
- **No `/tmp`.** Per coder safeguards, use project-root `./tmp/` for any scratch work (none expected here).

### Risks

- **RSK-1** — New rule added to the drift-guard scan list before a valid `redistributable` marker is in place → guard fails Mode 1/2. **Mitigated by** authoring the marker in Phase 1 and applying the header + verifying the marker **before** adding to the scan list in Phase 2 (explicit within-phase ordering). Residual: L.
- **RSK-2** — Any two of the three distribution lists (install / uninstall / guard) drift apart. The install↔guard pair is caught by guard mode 5 (derived-set drift); the uninstall list is **not** guard-observed, so uninstall↔install drift is invisible to CI. **Mitigated by** appending the identical string to all three lists in one atomic Phase-2 block (NFR-4 list-triple), the Phase-2 3-way byte-identity diff (AC-F6-6), and the uninstall list's own `# MUST stay in sync` comment invariant. Residual: L (install↔guard, CI-backed) / M (uninstall, manual backstop only — accepted; no automated parity check exists).
- **RSK-3** — Agents do not actually comply with a prompt-level rule → collateral damage still committed. **Mitigated by** discoverability via the README index + agent load-sections (F-5) and codifying existing organic best-practice. **Residual: M** (accepted; out of scope to enforce mechanically — NG-4).
- **RSK-4** — `.ados-claude/` mirrors go stale. **Mitigated by** the regeneration task (Phase 3) and the `test-build-claude-plugin.sh` freshness check (NFR-5). Residual: L.
- **RSK-5** — An agent performs the substring-overlap grep incorrectly (exact-match instead of *containing*) → false-clean. **Mitigated by** the rule's prescriptive, concrete grep guidance and the pre-**and**-post-substitution framing. Residual: M.

### Success Metrics

| Metric | Target |
|--------|--------|
| Bulk-edit-verify rule present in `.ai/rules/` catalog | 1 file (`bulk-edit-verify.md`) |
| Implementation agents with a load-reference | ≥ 2 (`@coder`, `@pm`) + README index row |
| Drift guard `bash scripts/.tests/test-doc-distribution.sh` | exits 0 (green) with the new rule installed + marked |
| Rule phrasing | verify gate + recovery expressed as **MUST**, not SHOULD/MAY |
| Install ↔ uninstall ↔ drift-guard list-triple | exactly one identical new entry in each of the three lists |

## Phases

> **Execution model.** `@coder` executes these phases in order, delegating each phase's commit to `@committer` (one Conventional Commit per phase). After each task: change `- [ ]` to `- [x]` with concise evidence. Phase acceptance is gated: do not advance until all **Must** criteria pass with evidence. Note: the PM retro-flagged that `@runner` may return an empty `task_result` in this environment — if a delegated heavy command (e.g., the drift guard) appears blank, fall back to running it directly and capturing output.

### Phase 1: Author the rule content

**Goal**: Create `.ai/rules/bulk-edit-verify.md` containing the trigger, the three-part verify gate, the substring-overlap check, the clean-revert recovery contract, and the #115 cross-link — with the `ados_distribution` marker in place (header applied in Phase 2 by the sanctioned script, never by hand).

**Tasks**:

- [x] **1.1** Create `.ai/rules/bulk-edit-verify.md`. Mirror the canonical rule-file format/structure of `.ai/rules/bash.md` (frontmatter `---` block, single `#` title, short intro, numbered/sectioned body, density consistent with the other rule files per NFR-3). Author the frontmatter with the **marker only** — `ados_distribution: redistributable` — and **do not** hand-write the copyright/MIT/source header lines (those are injected by the script in Phase 2; the script preserves the marker). *(F-6/AC-F6-2 prep)* — DONE: file created, 46 lines, marker-only frontmatter (no hand header).
- [x] **1.2** Author **§1 Trigger (When this rule activates)** (F-1): an objective condition — the rule activates when an edit touches **more than one file in a single operation**, OR any `sed`/`replaceAll`/regex substitution is performed, OR any find-and-replace over a path glob is performed; single-file single-occurrence edits are out of scope. Phrase as an objective condition, not a judgment call. *(AC-F1-1)* — DONE: TC-RULE-001 all 3 dimensions grep-OK.
- [x] **1.3** Author **§2 Three-part verify-before-commit gate** (F-2): before committing a bulk edit the agent **MUST**, in order — (a) `git diff --stat` to confirm the edited file set matches intent; (b) a targeted grep for the substituted token to confirm it landed where intended **and** did not land inside longer identifiers (the §3 check); (c) for code, run the project's typecheck/compile gate. State explicitly the verify is a **MUST executed *before* commit** (not SHOULD/MAY, not after). *(AC-F2-1, NFR-1)* — DONE: TC-RULE-002 all parts grep-OK; `git diff --stat`, `grep`, `typecheck/compile`, `before committ`; MUST count 6.
- [x] **1.4** Author **§3 Substring-overlap check** (F-3): before substituting token A→B the agent **MUST** grep for identifiers **containing** A (not just matching A) and confirm intent for each hit; on any unintended longer-identifier hit the agent **MUST** use word-boundary/anchored patterns or scoped paths rather than an unanchored global substitution. State the check runs **both** pre-substitution (planning) **and** post-substitution (verify), because the failure mode is a silent rewrite of the longer identifier. *(AC-F3-1)* — DONE: TC-RULE-003 all grep-OK (containing, word-boundary/anchored, scoped/narrow, pre+post-substitution).
- [x] **1.5** Author **§4 Clean-revert recovery contract** (F-4): if verification reveals collateral damage, the agent **MUST** revert the uncommitted edit (`git checkout -- <paths>` for the affected paths) and re-apply with safe substitutions (word-boundary/anchored/scoped), and **MUST NOT** attempt an in-place counter-edit (a counter-edit on an already-corrupted tree compounds the error and obscures the true intended change). *(AC-F4-1)* — DONE: TC-RULE-004 all grep-OK (`git checkout`, revert, re-apply, counter-edit/in-place, MUST NOT).
- [x] **1.6** Add a one-way cross-link reference comment to `#115` (large-artifact authoring policy) noting it increases bulk-edit exposure. Place it where it is naturally discoverable (e.g., a short "Related" note near the trigger). One-way only — no delivery dependency. *(AC-F1-2)* — DONE: `#115` count 1 (TC-RULE-005 OK); placed as a "Related" note in §1.
- [x] **1.7** Validate the rule renders as standard Markdown and the verify/recovery statements use the imperative **MUST** (NFR-1). Confirm the `ados_distribution: redistributable` marker is present in the frontmatter (AC-F6-2). The file is **not** yet in any scan list, so no guard exposure yet. — DONE: valid Markdown; MUST phrasing confirmed (count 6); marker present in frontmatter (`^ados_distribution: redistributable$` line 2).

**Acceptance Criteria**:

- Must: AC-F1-1 — file exists and states the trigger (multi-file edit / regex-substitution / glob find-and-replace). — PASSED (`.ai/rules/bulk-edit-verify.md` §1; TC-RULE-001 all 3 dimensions grep-OK).
- Must: AC-F2-1 — three-part verify gate phrased as MUST, executed before commit, with (a)/(b)/(c). — PASSED (§2; `git diff --stat` + targeted grep + typecheck/compile; MUST×6; "before committ" grep-OK).
- Must: AC-F3-1 — substring-overlap section requires grepping identifiers *containing* A, with word-boundary/anchored/scoped remedy, for both pre- and post-substitution stages. — PASSED (§3; TC-RULE-003 all grep-OK).
- Must: AC-F4-1 — recovery contract mandates revert (`git checkout -- <paths>`) + re-apply, and prohibits in-place counter-edits. — PASSED (§4; `git checkout` + revert + re-apply + `MUST NOT` counter-edit; TC-RULE-004 OK).
- Must: AC-F1-2 — one-way cross-link to `#115` present. — PASSED (§1 "Related (#115)"; `#115` count 1).
- Should: NFR-1 — valid Markdown, MUST phrasing; NFR-3 — density consistent with existing rule files. — PASSED (valid Markdown; MUST×6; 46 lines, consistent with concise rules testing-strategy.md≈48/README≈39; bash.md≈980 is the outlier, not the model).

**Files and modules**:

- Code areas: `.ai/rules/bulk-edit-verify.md` (new).
- System docs: none (advisory gap — no `feature-ai-rules.md`; see OQ-2).

**Tests**:

- Visual/structural read-through against `.ai/rules/bash.md` format and the four spec capability-details (§5.1 F-1..F-4).
- Confirm `ados_distribution: redistributable` parses in the first frontmatter block (can be pre-checked with the same `get_marker()` awk the guard uses).

**Completion signal**: `feat(gh-112): phase 1 — author bulk-edit-verify rule`

---

### Phase 2: Distribution truthfulness wiring

**Goal**: Make the new rule's `redistributable` marker honest and self-contained — apply the canonical header via the sanctioned script (preserving the marker), add the file to the installer's `ADOS_UPDATABLE_FILES`, add the identical entry to the uninstaller's `ADOS_LOCAL_STANDALONE_DOCS`, add the identical entry to the drift-guard `STANDALONE_DOCS`, and prove the drift guard is green. This realizes F-6 / AC-F6-1..6 and NFR-2/NFR-4 (list-triple sync).

> **Within-phase ordering is load-bearing (RSK-1/RSK-2).** Apply the header and verify the marker **before** adding the path to the scan list; append the **identical** string `.ai/rules/bulk-edit-verify.md` to **all three** lists (install + uninstall + guard) in one atomic block of tasks (2.3–2.5); then run the guard. The load-bearing ordering — header → marker → append to all three lists → run guard — still holds. Note: `uninstall.sh`'s `ADOS_LOCAL_STANDALONE_DOCS` is **not** observed by the guard (mode 5 compares the marker-derived set vs the sandbox install set), so its drift is not CI-caught — it is backstopped only by the Phase-2 3-way byte-identity diff and the list's own `# MUST stay in sync` comment invariant (DM-4 / AC-F6-6). Uninstall is kept with the other two appends for atomicity even though its ordering within the phase is not guard-critical.

**Tasks**:

- [ ] **2.1** Apply the canonical license header via the sanctioned script on the single file (never by hand): `scripts/add-header-location.sh .ai/rules/bulk-edit-verify.md`. *(AC-F6-1)*
- [ ] **2.2** Verify the 3-line MIT header is present (copyright + MIT + `source:` URL) **and** that `ados_distribution: redistributable` survived the script run (the script's `ensure_basic_header` preserves non-header frontmatter lines — confirm, do not assume). Re-run if missing. *(AC-F6-1, AC-F6-2 — also closes RSK-1)*
- [ ] **2.3** Append `.ai/rules/bulk-edit-verify.md` to the `ADOS_UPDATABLE_FILES` array in `scripts/install.sh` (place it adjacent to the existing `.ai/rules/README.md` entry). *(AC-F6-3, DM-2)*
- [ ] **2.4** Append the **identical** string `.ai/rules/bulk-edit-verify.md` to the `ADOS_LOCAL_STANDALONE_DOCS` array in `scripts/uninstall.sh` (adjacent to the existing `.ai/rules/README.md` entry, array at lines 103–109, used at 414–422 to remove redistributable docs on `uninstall.sh --local`). *(AC-F6-6, DM-4, NFR-4)*
- [ ] **2.5** Append the **identical** string `.ai/rules/bulk-edit-verify.md` to the `STANDALONE_DOCS` array in `scripts/.tests/test-doc-distribution.sh` (adjacent to the existing `.ai/rules/README.md` entry). *(AC-F6-4, DM-3, NFR-4)*
  - *Atomicity note (tasks 2.3–2.5):* these three appends are one atomic block — all use the **byte-identical** string `.ai/rules/bulk-edit-verify.md` (NFR-4 list-triple sync). The uninstall list is NOT covered by the drift guard, so AC-F6-6 is verified by grep + the 3-way byte-identity diff in the Phase-2 Tests step (not by CI); the uninstall list's own `# MUST stay in sync` comment is the documented invariant.
- [ ] **2.6** Run `bash scripts/.tests/test-doc-distribution.sh`. It **MUST exit 0**. Rationale for why it stays green: the file is `redistributable` (Mode 1/2 pass), it is in `ADOS_UPDATABLE_FILES` so the sandbox `install.sh --local` run copies it into the actual set (Mode 3 passes; Mode 5 expected==actual passes because the install + guard lists both carry the entry). Note: the guard does not observe `ADOS_LOCAL_STANDALONE_DOCS`, so it cannot verify the uninstall entry — that is the 3-way diff's job, not the guard's. Capture the `[OK]` line as evidence. *(AC-F6-5, NFR-2 — also closes RSK-2)*

**Acceptance Criteria**:

- Must: AC-F6-1 — standard 3-line MIT header present, applied via the script.
- Must: AC-F6-2 — frontmatter declares `ados_distribution: redistributable`.
- Must: AC-F6-3 — `ADOS_UPDATABLE_FILES` contains one entry for the new path.
- Must: AC-F6-4 — `STANDALONE_DOCS` contains one entry, identical string to the installer entry.
- Must: AC-F6-5 — `bash scripts/.tests/test-doc-distribution.sh` exits 0.
- Must: AC-F6-6 — `ADOS_LOCAL_STANDALONE_DOCS` (uninstall) contains one entry for the new path, identical string to the install + guard entries (DM-4). Verified by grep + 3-way byte-identity diff (uninstall list is not guard-observed).
- Should: NFR-4 — the three list strings (install + uninstall + guard) are byte-identical (list-triple sync).

**Files and modules**:

- Code areas: `scripts/install.sh` (updated — +1 `ADOS_UPDATABLE_FILES` entry), `scripts/uninstall.sh` (updated — +1 `ADOS_LOCAL_STANDALONE_DOCS` entry), `scripts/.tests/test-doc-distribution.sh` (updated — +1 `STANDALONE_DOCS` entry). `.ai/rules/bulk-edit-verify.md` (header applied by the script, not by hand).
- System docs: none.

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (evidence: final `[OK]   no drift …` line).
- **3-way byte-identity assertion (NFR-4 list-triple / AC-F6-6):** extract the quoted path from install.sh `ADOS_UPDATABLE_FILES`, uninstall.sh `ADOS_LOCAL_STANDALONE_DOCS`, and the guard `STANDALONE_DOCS`; `diff` all three against each other — every pair must be byte-identical (all three resolve to `.ai/rules/bulk-edit-verify.md`). Because the uninstall list is **not** guard-observed, this grep + diff is the only automated check for the uninstall entry; the uninstall list's own `# MUST stay in sync` comment is the documented invariant.

**Completion signal**: `feat(gh-112): phase 2 — wire bulk-edit-verify distribution`

---

### Phase 3: Discovery, agent loading & generated-plugin regeneration

**Goal**: Make the rule discoverable and loadable (README index row + `@coder`/`@pm` load-references) and keep the generated Claude Code plugin fresh by regenerating the `.ados-claude/agents/*.md` mirrors and committing them **together** with the `.opencode/agent/` source edits (NFR-5 / AC-F5-4).

> Per AGENTS.md "Generated plugin rule", the `.opencode/` source edits and the regenerated `.ados-claude/` mirrors ship in **one** commit.

**Tasks**:

- [ ] **3.1** Add a row to the `.ai/rules/README.md` index table: Task/Context `Bulk edits / substitutions`, Rule File `bulk-edit-verify.md`, and a concise description (verify-before-commit gate incl. substring-overlap check + clean-revert recovery). No structural change to the table schema. *(AC-F5-3, DM-1)*
- [ ] **3.2** Add a load-reference to the new rule in `.opencode/agent/coder.md`. `@coder` has no dedicated rule-loading section today — add a concise rule-loading note at the natural insertion point (e.g., in workflow Phase A initialization and/or a short `<rule_loading>`/safeguard rule) instructing `@coder` to consult `.ai/rules/README.md` and load `bulk-edit-verify.md` before any multi-file/bulk edit (F-1 trigger). Keep the edit tight (per AGENTS.md "keep prompts tight"). *(AC-F5-1)*
- [ ] **3.3** Add a load-reference to the new rule in `.opencode/agent/pm.md` for when PM implements directly (DEC-3). Add a concise note at the natural insertion point (e.g., near its workflow/rules) that `@pm` loads `bulk-edit-verify.md` when it performs edits directly. *(AC-F5-2)*
- [ ] **3.4** Regenerate the generated plugin from the edited sources: `scripts/build-claude-plugin.sh`. Commit the regenerated `.ados-claude/agents/coder.md` and `.ados-claude/agents/pm.md` (and any other regenerated files) **together** with the `.opencode/agent/` source edits. *(AC-F5-4, NFR-5)*
- [ ] **3.5** Verify plugin freshness: run `bash scripts/.tests/test-build-claude-plugin.sh` (exit 0) and confirm `git status --porcelain .ados-claude/` shows no stale/uncommitted mirrors after regeneration (i.e., re-running the build produces no further diff). *(NFR-5 — also closes RSK-4)*

**Acceptance Criteria**:

- Must: AC-F5-3 — `.ai/rules/README.md` index has a row for `bulk-edit-verify.md` with task/context + description.
- Must: AC-F5-1 — `@coder` definition references the bulk-edit-verify rule.
- Must: AC-F5-2 — `@pm` definition references the bulk-edit-verify rule (for direct implementation).
- Must: AC-F5-4 — `.ados-claude/agents/*.md` mirrors are current (regenerated + committed with the source edits).
- Should: NFR-5 — `test-build-claude-plugin.sh` green; no stale generated files.

**Files and modules**:

- Code areas: `.ai/rules/README.md` (updated — +1 index row); `.opencode/agent/coder.md` (updated — +load-reference); `.opencode/agent/pm.md` (updated — +load-reference); `.ados-claude/agents/coder.md`, `.ados-claude/agents/pm.md` (regenerated — never hand-edited).
- System docs: none.

**Tests**:

- `bash scripts/.tests/test-build-claude-plugin.sh` → exit 0.
- `git status --porcelain .ados-claude/` clean after a re-run of the build (no staleness).

**Completion signal**: `feat(gh-112): phase 3 — index rule, wire coder/pm loads, regenerate plugin`

---

### Phase 4: Final verification, spec reconciliation & release

**Goal**: Prove the whole change is internally consistent and all 15 acceptance criteria pass with evidence; reconcile the spec/plan checkboxes; confirm no runtime version artifact needs bumping. This is the release gate before review/quality-gates/PR.

**Tasks**:

- [ ] **4.1** Re-run the full drift guard: `bash scripts/.tests/test-doc-distribution.sh` → exit 0. *(AC-F6-5, NFR-2)*
- [ ] **4.2** Run the generated-plugin freshness check: `bash scripts/.tests/test-build-claude-plugin.sh` → exit 0; `git status --porcelain .ados-claude/` clean. *(AC-F5-4, NFR-5)*
- [ ] **4.3** Clean-tree sanity: `git diff --check` (no whitespace errors) across the touched files; confirm only intended files changed (rule file, README index, coder.md, pm.md, install.sh, uninstall.sh, drift-test, regenerated `.ados-claude/agents/*`).
- [ ] **4.4** **Acceptance pass** — walk all 15 ACs (AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F1-2, AC-F5-1, AC-F5-2, AC-F5-3, AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, AC-F6-5, AC-F6-6, AC-F5-4) and record PASSED with concrete evidence (file/line or command output). Block on any FAILED.
- [ ] **4.5** **Spec reconciliation** — confirm `doc/spec/**` needs no edit for this change. The `.ai/rules/` system has no feature spec (advisory gap, OQ-2); this change extends the distribution surface by one standalone doc only. Record that the gap is advisory and will be re-surfaced by `@doc-syncer` at system_spec_update (no `doc/spec/**` write required here). *(Appendix B)*
- [ ] **4.6** **Version bump per repo conventions.** This repo ships prompts/agents/docs, not a versioned runtime — confirm there is no `CHANGELOG*`/`VERSION`/package manifest to bump (verified: none at root). The change's `version_impact: patch` is recorded in the change metadata only; no runtime version bump applies.
- [ ] **4.7** Update this plan's checkboxes/evidence and the Execution Log; ensure the spec's validation checklist still holds.

**Acceptance Criteria**:

- Must: All 15 spec ACs PASSED with evidence (AC-F1-1 … AC-F6-6, AC-F5-4).
- Must: Drift guard green (AC-F6-5) and generated-plugin freshness green (AC-F5-4/NFR-5). For AC-F6-6 (uninstall list, not guard-observed) the evidence is the 3-way byte-identity diff, not the guard exit code.
- Must: Spec reconciliation decision recorded (no `doc/spec/**` edit required — advisory OQ-2 gap deferred to `@doc-syncer`).
- Should: Version-bump decision recorded (metadata-only `patch`; no runtime artifact to bump).

**Files and modules**:

- Code areas: none (verification + record-keeping phase).
- System docs: none (advisory gap deferred).

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.
- `bash scripts/.tests/test-build-claude-plugin.sh` → exit 0.
- `git diff --check` clean.

**Completion signal**: `feat(gh-112): phase 4 — verify all ACs, reconcile spec, release`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | A reader opens `.ai/rules/bulk-edit-verify.md` and finds an objective trigger, a MUST three-part verify gate, a substring-overlap check (pre+post), a clean-revert contract, and a #115 cross-link | 1 | AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F1-2 |
| TS-2 | `scripts/add-header-location.sh .ai/rules/bulk-edit-verify.md` applies the 3-line MIT header and the `ados_distribution: redistributable` marker survives | 2 | AC-F6-1, AC-F6-2 |
| TS-3 | `ADOS_UPDATABLE_FILES`, `ADOS_LOCAL_STANDALONE_DOCS`, and `STANDALONE_DOCS` each contain exactly one byte-identical entry for `.ai/rules/bulk-edit-verify.md` | 2 | AC-F6-3, AC-F6-4, AC-F6-6, NFR-4 |
| TS-4 | With the rule installed + marked redistributable, `bash scripts/.tests/test-doc-distribution.sh` exits 0 (Modes 1–5 pass) | 2, 4 | AC-F6-5, NFR-2 |
| TS-5 | `.ai/rules/README.md` index contains a `bulk-edit-verify.md` row; `@coder` and `@pm` definitions reference the rule | 3 | AC-F5-1, AC-F5-2, AC-F5-3 |
| TS-6 | After editing `.opencode/agent/{coder,pm}.md`, `scripts/build-claude-plugin.sh` regenerates `.ados-claude/agents/{coder,pm}.md` and `test-build-claude-plugin.sh` stays green with no stale mirrors | 3, 4 | AC-F5-4, NFR-5 |
| TS-7 | `@reviewer` discovers the new rule via its existing `.ai/rules/` pre-flight auto-load — no reviewer change required | (none) | (F-5 — verified by inspection of reviewer.md lines 118 & 144) |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-112-spec.md | Spec |
| Change PM notes | ./chg-GH-112-pm-notes.yaml | PM notes (decisions DEC-1/2/3, OQs) |
| Implementation plan | ./chg-GH-112-plan.md | Plan (this file) |
| New rule | `.ai/rules/bulk-edit-verify.md` | Rule (new) |
| Rules index | `.ai/rules/README.md` | Index (updated — +1 row) |
| Coder agent | `.opencode/agent/coder.md` | Agent source (updated — +load-ref) |
| PM agent | `.opencode/agent/pm.md` | Agent source (updated — +load-ref) |
| Generated coder mirror | `.ados-claude/agents/coder.md` | Generated (regenerated — never hand-edit) |
| Generated PM mirror | `.ados-claude/agents/pm.md` | Generated (regenerated — never hand-edit) |
| Installer manifest | `scripts/install.sh` | Script (updated — +1 `ADOS_UPDATABLE_FILES` entry) |
| Uninstaller manifest | `scripts/uninstall.sh` | Script (updated — +1 `ADOS_LOCAL_STANDALONE_DOCS` entry) |
| Drift guard | `scripts/.tests/test-doc-distribution.sh` | Test (updated — +1 `STANDALONE_DOCS` entry) |
| Header script (used, not modified) | `scripts/add-header-location.sh` | Script (invoked on the new file) |
| Plugin build script (used, not modified) | `scripts/build-claude-plugin.sh` | Script (run to regenerate mirrors) |
| Related spec — doc distribution marker | `doc/spec/features/feature-doc-distribution-marker.md` | Feature spec (GH-67) |
| Related spec — license header script | `doc/spec/features/feature-license-header-script.md` | Feature spec (GH-26) |
| Related spec — claude plugin generation | `doc/spec/features/feature-claude-plugin-generation.md` | Feature spec |
| Related change | `#115` — large-artifact authoring policy | Related (soft dep; one-way cross-link) |
| Epic | `#107` — drift detection & gate enforcement | Epic |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | plan-writer | Initial plan; 4 phases (author rule → distribution wiring → discovery+agent-load+regen → verify/release); carries spec decisions DEC-1/2/3 and AC-F1-1 … AC-F6-5/AC-F5-4. Phasing aligns to spec §18 rollout with Phase 3+4 merged so source edits and generated mirrors commit together (NFR-5). |
| 1.1 | 2026-07-03 | plan-writer | DoR-iter-1 remediation (PM-confirmed, re-delegated). Added the THIRD distribution list the initial Phase 2 missed: `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` (array lines 103–109, used at 414–422 to remove redistributable docs on `uninstall.sh --local`; its own comment states it MUST stay in sync with install.sh's standalone manifest). The mirror model `.ai/rules/README.md` is present in all three lists (install + uninstall + guard), so the new rule must be too — otherwise it is orphaned on adopting-project uninstall (contradicts G-5). Changes: Phase 2 +1 task (new **2.4** uninstall append; guard-append renumbered 2.4→2.5, run-guard 2.5→2.6); the three append tasks (2.3–2.5) now form an atomic block using the byte-identical string `.ai/rules/bulk-edit-verify.md`. New AC **AC-F6-6** (uninstall entry identical to install + guard); **NFR-4** broadened from list-PAIR to list-TRIPLE sync; new data-model element **DM-4**. Phase-2 AC/Files/Tests updated (incl. a 3-way byte-identity diff assertion). Note: the uninstall list is NOT guard-observed (mode 5 ignores it), so AC-F6-6 is verified by grep + 3-way diff, not CI. AC tally 14→15. Consistency sweeps: DEC-1, RSK-2, §Scope In Scope/Constraints/Success Metrics, summary, TS-3, Phase 4 (Goal/4.3/4.4/AC), Artifacts table — all updated pair→triple. Spec + test-plan amended in parallel (this plan file only). |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | pending | — | — | — | — |
| 2 | pending | — | — | — | — |
| 3 | pending | — | — | — | — |
| 4 | pending | — | — | — | — |
