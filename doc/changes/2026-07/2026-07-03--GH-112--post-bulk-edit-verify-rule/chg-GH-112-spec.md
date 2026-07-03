---
workItemRef: GH-112
title: "Post-bulk-edit verify rule (grep/diff verify before commit)"
links:
  epic: "#107"
  related_changes: ["#115"]
  specs:
    - "doc/spec/features/feature-doc-distribution-marker.md"
    - "doc/spec/features/feature-license-header-script.md"
    - "doc/spec/features/feature-claude-plugin-generation.md"
change:
  ref: GH-112
  type: feat
  status: Proposed
  slug: post-bulk-edit-verify-rule
  title: "Post-bulk-edit verify rule (grep/diff verify before commit)"
  owners: ["Juliusz Ćwiąkalski"]
  service: ai-rules
  labels: ["rules", "agents", "doc-distribution", "guard"]
  version_impact: patch
  audience: mixed
  security_impact: none
  risk_level: low
  dependencies:
    internal: [".ai/rules/", ".opencode/agent/", "scripts/install.sh", "scripts/.tests/test-doc-distribution.sh", "scripts/uninstall.sh", ".ados-claude/"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Codify a standing implementation rule that requires every implementation agent to verify (grep + diff + compile gate) the results of any bulk/tree-wide edit BEFORE committing — with an explicit substring-overlap check and a clean-revert recovery contract — so that collateral damage from global substitutions is caught before it reaches version control.

## 1. SUMMARY

Introduce a new standalone rule file in the `.ai/rules/` catalog — `bulk-edit-verify.md` — that makes post-bulk-edit verification a mandatory, loadable implementation rule rather than ad-hoc agent behavior. The rule defines a trigger (any multi-file edit, regex substitution, or find-and-replace over a glob), a three-part verify gate (diff-stat confirmation, targeted grep including the substring-overlap check, and a typecheck/compile gate for code), and a recovery contract (revert + re-apply, never in-place counter-edits). The rule is made discoverable by adding it to the rules README index and wiring a load-reference into the implementation agents (`@coder`, `@pm` when implementing directly). Because the rule is marked `redistributable`, it must be distributed truthfully — mirroring how the rules README is treated: license header, distribution marker, an entry in the installer's updatable-files list, and an entry in the drift-guard scan list.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The `.ai/rules/` catalog contains four files: `README.md` (the discovery index), `bash.md`, `installer.md`, and `testing-strategy.md`. The README index lists three rule rows (bash, installer, testing-strategy).
- Rule discovery is index-driven: agents (especially `@plan-writer` and `@coder`) consult `.ai/rules/README.md` to decide which rule files to load for a task; the README's "How agents use rules" section governs the load protocol.
- `@reviewer` auto-loads `.ai/rules/` files relevant to the languages in a diff (reviewer pre-flight, step 2), so it discovers rules via the same catalog.
- Distribution of `.ai/rules/` content to adopting projects is narrow: `scripts/install.sh` installs **only** `.ai/rules/README.md` (it is the sole `.ai/rules/` entry in `ADOS_UPDATABLE_FILES`). The other rule files (`bash.md`, `installer.md`, `testing-strategy.md`) are not installed and have inconsistent header/marker status.
- The `ados_distribution` marker system (delivered by GH-67, spec `feature-doc-distribution-marker.md`) classifies docs and drives a five-mode CI drift guard. The guard's closed scan scope (DM-2) includes exactly five standalone docs, one of which is `.ai/rules/README.md`. A `redistributable` marker on a doc not present in the install set would fail guard mode 3 (redistributable-not-installed).
- License headers are applied to distributable paths by `scripts/add-header-location.sh` (spec `feature-license-header-script.md`), which is the sole sanctioned mechanism; agents must never add headers by hand.

### 2.2 Pain Points / Gaps

- **No bulk-edit safety rule exists.** During a delivery, an agent ran a global `sed` substitution whose pattern overlapped a package-declaration substring, catastrophically rewriting a package path across `src/` (many files, including all tests). The damage was caught only because the agent performed an **organic** post-edit grep verify step — diagnosed the substring overlap, reverted cleanly, and re-applied package-safe substitutions. This verify step is not codified; a future agent omitting it would commit collateral damage.
- **Substring-overlap hazard is invisible to the catalog.** When one identifier is a substring of another, a global substitution silently corrupts the longer identifier. There is no rule requiring an agent to grep for identifiers *containing* the target token before substituting.
- **No recovery contract.** There is no standing rule governing what an agent must do if a bulk edit is found to have caused collateral damage (revert + re-apply with safe substitutions vs. an in-place counter-edit that can compound the error).
- **`.ai/rules/` has no feature spec.** No `doc/spec/features/feature-ai-rules.md` documents the rule catalog, the README discovery index, or how/whether rule files are distributed. This change touches that undocumented area (advisory coverage gap — see §14 OQ-2).

## 3. PROBLEM STATEMENT

Because ADOS has no codified implementation rule requiring verification after a bulk/tree-wide edit, implementation agents can omit the organic grep/diff verify step and commit collateral damage when a global substitution's pattern overlaps a longer identifier — a classic bulk-edit failure mode that has already occurred in practice and was caught only by chance.

## 4. GOALS

- **G-1**: Make post-bulk-edit verification a **standing, loadable implementation rule** (a `.ai/rules/` file), not ad-hoc behavior.
- **G-2**: Codify the **substring-overlap check** as the highest-value specific addition — the exact technique that caught the real-world corruption.
- **G-3**: Define a **clean-revert recovery contract** so agents never attempt in-place counter-edits to undo collateral damage.
- **G-4**: Make the rule **discoverable** by implementation agents via the README index and agent load-sections.
- **G-5**: Ensure the rule is **distributed truthfully** — its `redistributable` marker is backed by actual installer/drift-guard wiring, so it cannot become the drift the GH-67 guard exists to prevent.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Bulk-edit-verify rule present in `.ai/rules/` catalog | 1 file (`bulk-edit-verify.md`) |
| Implementation agents with a load-reference to the rule | ≥ 2 (coder, pm) + README index |
| Drift guard (`scripts/.tests/test-doc-distribution.sh`) | exits 0 (green) with the new rule installed |
| Rule phrasing | verify gate expressed as MUST, not SHOULD/MAY |

### 4.2 Non-Goals

- **NG-1**: Banning global `sed` or other bulk-edit tools — the rule assumes bulk edits happen and governs *verification*, not prohibition.
- **NG-2**: Building or adopting a general AST-aware refactor tool.
- **NG-3**: Cleaning up the inconsistent header/marker status of the existing rule files (`bash.md`, `installer.md`, `testing-strategy.md`) — they are out of scope; this change only adds the new rule + mirrors the README's established pattern.
- **NG-4**: Creating a runtime/hard gate that *enforces* the rule mechanically — it remains a prompt-level rule loaded by agents (see RSK-3 residual risk).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Bulk-edit trigger definition | The rule must clearly state *when* it activates so agents know whether the verify gate applies to their edit. |
| F-2 | Three-part verify-before-commit gate | A deterministic, repeatable verification sequence (diff-stat, targeted grep, typecheck/compile) catches the full damage-spectrum before a commit. |
| F-3 | Substring-overlap pre-check | The specific technique that caught the real-world corruption — the highest-value addition; without it, the most catastrophic failure mode is unchecked. |
| F-4 | Clean-revert recovery contract | A defined recovery path prevents compounding damage via in-place counter-edits. |
| F-5 | Rule discovery & agent loading | A rule that no agent loads is inert; the index + load-references are what make it effective. |
| F-6 | Distribution truthfulness | A `redistributable` marker without installer/drift wiring is a semantic lie; truthful distribution makes the marker honest and self-contained. |

### 5.1 Capability Details

**F-1 — Bulk-edit trigger definition.** The rule activates when any edit touches more than one file in a single operation, OR any `sed`/`replaceAll`/regex substitution is performed, OR any find-and-replace over a path glob is performed. Single-file, single-occurrence edits are out of scope. The trigger is phrased as an objective condition, not a judgment call.

**F-2 — Three-part verify-before-commit gate.** Before committing a bulk edit, the agent MUST perform, in order: (a) `git diff --stat` to confirm the edited file set matches intent; (b) a targeted grep for the substituted token to confirm it landed where intended AND did not land inside longer identifiers (the F-3 substring-overlap check); (c) for code, run the project's typecheck/compile gate before committing. The verify is a MUST executed *before* commit — not after.

**F-3 — Substring-overlap pre-check.** Before substituting token A → B, the agent MUST grep for identifiers *containing* A (not just matching A) and confirm intent for each hit. If any longer-identifier hit is not intended, the agent MUST use word-boundary/anchored patterns or scoped paths rather than an unanchored global substitution. This check is performed both pre-substitution (planning) and post-substitution (verify), because the failure mode is a silent rewrite of the longer identifier.

**F-4 — Clean-revert recovery contract.** If verification reveals collateral damage, the agent MUST revert the uncommitted edit (`git checkout -- <paths>` for the affected paths) and re-apply with safe substitutions (word-boundary/anchored patterns or scoped paths). The agent MUST NOT attempt an in-place counter-edit to undo the damage, because a counter-edit on an already-corrupted tree compounds the error and obscures the true intended change.

**F-5 — Rule discovery & agent loading.** The rule is registered in the `.ai/rules/README.md` index table (task/context row, file name, description) so the discovery protocol surfaces it. The implementation agents that perform edits (`@coder`, and `@pm` when it implements directly) gain a load-reference in their rule-loading sections. `@reviewer` already auto-loads `.ai/rules/` files relevant to the diff via its pre-flight, so it discovers the rule through the index without a dedicated reference; note the rule is process-level (not language-specific), so reviewer loading is best-effort.

**F-6 — Distribution truthfulness.** The new rule mirrors how `.ai/rules/README.md` is treated end-to-end across ALL THREE hand-synced distribution lists: (1) license header applied via `scripts/add-header-location.sh` (never by hand); (2) `ados_distribution: redistributable` frontmatter marker; (3) an entry in `scripts/install.sh` `ADOS_UPDATABLE_FILES` so the file is actually redistributed; (4) an entry in the drift-guard `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS` scan list so the marker is enforced; (5) an entry in `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` so the file is removed cleanly on uninstall and cannot become an orphaned file on adopting projects. This makes the marker truthful and self-contained end-to-end (install → guard → uninstall) — a bare marker on an uninstalled file would fail guard mode 3 and is exactly the drift class the GH-67 guard prevents. (Note: `ADOS_UPDATABLE_FILES`, `STANDALONE_DOCS`, and `ADOS_LOCAL_STANDALONE_DOCS` are three independent copies that must be kept in sync by hand per ODR-0001; guard mode 5 catches drift between the install and guard lists, but no automated test currently observes the uninstall list — see RSK-6.)

## 6. USER & SYSTEM FLOWS

```
Flow 1: Agent performs a safe bulk edit
  Agent decides to substitute token A→B across N files (F-1 trigger)
  → Pre-check: grep for identifiers containing A; confirm intent for each (F-3)
  → Apply substitution (word-boundary/anchored or scoped if overlap found)
  → Verify: git diff --stat (intended file set) + grep A/B (landed correctly, no collateral) + typecheck/compile (code) (F-2)
  → All checks pass → commit

Flow 2: Agent finds collateral damage during verify
  Agent applies a bulk edit
  → Verify (F-2) finds the token landed inside longer identifiers (F-3 detects overlap)
  → Recovery: git checkout -- <affected paths> to revert the uncommitted edit (F-4)
  → Re-apply with safe substitutions (word-boundary/anchored/scoped)
  → Re-verify → commit
  (Never: in-place counter-edit to undo the damage)

Flow 3: Rule discovery
  Implementation agent (@coder / @pm) begins a task
  → Consults .ai/rules/README.md index (F-5)
  → Sees bulk-edit-verify.md row for "bulk edits / substitutions"
  → Loads the rule before any multi-file edit
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A new standalone rule file `.ai/rules/bulk-edit-verify.md` containing the trigger (F-1), three-part verify (F-2), substring-overlap check (F-3), and clean-revert recovery contract (F-4).
- A new row in `.ai/rules/README.md` index table for the new rule (F-5).
- A load-reference to the new rule in `@coder`'s rule-loading section and `@pm`'s rule-loading section (F-5).
- Regeneration of the `.ados-claude/` generated plugin mirrors from the edited `.opencode/agent/` sources, committed alongside (the mirrors are generated artifacts — never hand-edited; regenerated via the sanctioned build step).
- Distribution wiring for the new rule (F-6): license header via the header script, `ados_distribution: redistributable` marker, one entry in `install.sh` `ADOS_UPDATABLE_FILES`, one entry in the drift-guard `STANDALONE_DOCS`, and one entry in `uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS`.
- A one-way cross-link comment inside the new rule referencing #115 (large-artifact authoring policy), which increases bulk-edit exposure.

### 7.2 Out of Scope

- [OUT] Banning or restricting global `sed`/bulk-edit tools.
- [OUT] A general AST-aware refactor tool.
- [OUT] Cleaning up the inconsistent header/marker status of existing rule files (`bash.md`, `installer.md`, `testing-strategy.md`).
- [OUT] A runtime/hard gate that mechanically enforces the verify step (it remains a prompt-level rule).
- [OUT] Creating `doc/spec/features/feature-ai-rules.md` (advisory coverage gap; see §14 OQ-2).

### 7.3 Deferred / Maybe-Later

- **Loading the rule in `@fixer`.** `@fixer` applies edits and is exposed to the same substring-overlap hazard as `@coder`. The PM baseline scope is coder + pm + README index; fixer is a strong candidate for a follow-up but is deferred to keep this change tightly scoped. See OQ-1.
- **Documenting the `.ai/rules/` system in a feature spec** (`feature-ai-rules.md`) covering the catalog, the README discovery index, and rule-file distribution. Advisory; re-surfaced at system_spec_update by `@doc-syncer`. See OQ-2.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change introduces no HTTP endpoints. It adds a static rule document and static wiring into installer/guard lists.

### 8.2 Events / Messages

N/A — no events or messages are introduced or modified.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `.ai/rules/README.md` index table | One new row added (bulk-edit / `bulk-edit-verify.md` / description). No structural change to the table schema. |
| DM-2 | `scripts/install.sh` `ADOS_UPDATABLE_FILES` array | One new string entry (the new rule path) appended. |
| DM-3 | `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS` array | One new string entry (the new rule path) appended, mirroring DM-2. |
| DM-4 | `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` array | One new string entry (the new rule path) appended, mirroring DM-2/DM-3. Used at uninstall lines 414-422 to remove redistributable docs on uninstall; its comment requires it stay in sync with install.sh's standalone manifest. |

### 8.4 External Integrations

N/A — no external APIs or services are affected.

### 8.5 Backward Compatibility

- **Additive only.** The new rule is a new file and new list entries; no existing rule, agent contract, or installed file is removed or renamed.
- **Agent behavior.** Loading the rule changes *what* implementation agents verify, not the format of their outputs. The verify step codifies existing organic best-practice, so compliant agents experience no behavioral regression.
- **Installer/drift-guard/uninstaller.** Adding to `ADOS_UPDATABLE_FILES` causes the new rule to be installed on the next `install.sh` run for adopting projects; adopting projects' existing `.ai/rules/` content is untouched (the installer's updatable-file semantics apply). The drift-guard scan set and the uninstaller removal list are intentionally independent copies (ODR-0001); all three lists (DM-2/DM-3/DM-4) are updated together in this change with byte-identical path strings.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Rule loadability / clarity | The rule is valid standard Markdown (all headings, lists, and tables render); the verify gate is phrased as an imperative MUST (not SHOULD/MAY). |
| NFR-2 | Distribution correctness | `bash scripts/.tests/test-doc-distribution.sh` exits 0 (green) with the new rule present and marked `redistributable`. |
| NFR-3 | Rule conciseness | The rule file length is bounded to keep agent-context token cost low — density consistent with the existing rule files (single topic, no redundancy). |
| NFR-4 | List-triple synchronization | The installer list (`ADOS_UPDATABLE_FILES`), the drift-guard scan list (`STANDALONE_DOCS`), AND the uninstall list (`ADOS_LOCAL_STANDALONE_DOCS`) each contain exactly one new entry for the new rule, with byte-identical path strings across all three. |
| NFR-5 | Generated-plugin freshness | After editing `.opencode/agent/` sources, the `.ados-claude/agents/` mirrors are regenerated and committed together so the generated-plugin-staleness CI check stays green. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — rule files are static documents with no runtime metrics, logs, traces, or alerts. Observability of *compliance* is indirect: the drift guard (CI) observes distribution correctness; the reviewer observes whether loaded rules were applied during a change review.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | New rule added to the drift-guard scan list before a valid `redistributable` marker is in place → guard fails mode 1/2 (missing/invalid marker). | M | M | Apply the marker + header as part of the same delivery; verify the guard is green before completion (NFR-2). | L |
| RSK-2 | The installer list and the drift-guard scan list drift apart (they are hand-synced per ODR-0001) → guard mode 5 fires. | M | M | Both install/guard lists updated in the same change with identical path strings (NFR-4); guard mode 5 is the independent backstop for this pair. (The uninstall list has no automated observer — see RSK-6.) | L |
| RSK-3 | Agents do not actually comply with the rule (a prompt-level rule is advisory at runtime; an agent that skips loading or skips verify can still commit collateral damage). | H | M | Make the rule discoverable via the README index + agent load-sections (F-5); codify existing organic best-practice so the gap is named, not invented; the substring-overlap check is the concrete, high-value step. | M |
| RSK-4 | The `.ados-claude/` generated mirrors become stale if the agent edits are not followed by the sanctioned plugin-build step. | M | L | The plan includes a regeneration step after agent edits; the generated-plugin-staleness CI check verifies freshness (NFR-5). | L |
| RSK-5 | The substring-overlap grep is itself performed incorrectly by an agent (e.g., grepping for exact matches instead of *containing* identifiers), giving a false-clean result. | M | M | The rule gives concrete, prescriptive grep guidance (search identifiers *containing* A; use word-boundary/anchored patterns or scoped paths) and states the check runs both pre- and post-substitution. | M |
| RSK-6 | No automated test observes the uninstall list (`ADOS_LOCAL_STANDALONE_DOCS`); the guard's mode 5 observes only the install set, not uninstall. The uninstall list could drift from the install/guard lists, leaving the new rule orphaned on adopting projects after an uninstall. | M | L | The uninstall list's own comment requires it "MUST stay in sync with install.sh's standalone manifest"; AC-F6-6 + reviewer verification are the backstop in this change. Future hardening could add an install/uninstall symmetry test. | M |

## 12. ASSUMPTIONS

- The `.ai/rules/README.md` pattern (license header + `redistributable` marker + installer entry + drift-guard entry) is the correct, established model for a redistributable rule file — it is the only currently-installed rule file.
- `@reviewer` discovers rules through the README index and its pre-flight `.ai/rules/` load (confirmed: reviewer pre-flight step 2 loads `.ai/rules/` files relevant to the diff); no dedicated reviewer change is needed for the rule to be surfaced during review.
- The new rule is process-level guidance consumed by AI agents; it is not a build tool and has no programmatic enforcement beyond CI distribution checks and reviewer compliance checks.
- `#115` (large-artifact authoring policy) is not yet delivered; the cross-link is a one-way reference comment and creates no delivery dependency.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on (soft) | #115 — large-artifact authoring policy | Soft dependency only; #115 increases bulk-edit exposure (direct authoring). Cross-link is one-way; GH-112 does not block on #115 delivery. |
| Builds on | GH-67 — marker-driven doc distribution | Provides the `ados_distribution` marker system, the five-mode drift guard, and the closed DM-2 scan scope that this change extends by one standalone-doc entry. Spec: `feature-doc-distribution-marker.md`. |
| Builds on | GH-26 — license header script | Provides `scripts/add-header-location.sh`, the sole sanctioned header mechanism this change relies on. Spec: `feature-license-header-script.md`. |
| Builds on | Claude-plugin generation | Provides the `.opencode/` → `.ados-claude/` generation contract this change must honor. Spec: `feature-claude-plugin-generation.md`. |
| Blocks | none | Nothing downstream depends on GH-112. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should `@fixer` also load the new rule in its rule-loading section? | `@fixer` applies edits and is exposed to the same substring-overlap hazard as `@coder`. PM baseline scope is coder + pm + README index; fixer is deferred to keep this change tight. | Deferred to §7.3; revisit as a small follow-up. Decision needed: consult `@decision-advisor` if expanding scope. |
| OQ-2 | Should a follow-up spec ticket create `doc/spec/features/feature-ai-rules.md`? | No feature spec documents the `.ai/rules/` catalog, the README discovery index, or rule-file distribution. This change touches that undocumented area. | Advisory coverage gap — not a delivery blocker. Will be re-surfaced at system_spec_update by `@doc-syncer`; human decides whether a follow-up ticket is warranted. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The new rule mirrors the `.ai/rules/README.md` treatment end-to-end (header + `redistributable` marker + `ADOS_UPDATABLE_FILES` entry + `STANDALONE_DOCS` entry). | install.sh currently installs ONLY the rules README; a bare `redistributable` marker on an uninstalled file would be a semantic lie — exactly the drift the GH-67 guard prevents. Mirroring README is truthful and self-contained (one new file, +1 installer line, +1 drift-test line) without forcing a cleanup of the inconsistent existing rule files (out of scope). This means ticket AC #4 (marker + header) implies installer + drift-test wiring. (Expanded to three lists in v1.1 — uninstall.sh ADOS_LOCAL_STANDALONE_DOCS added per DM-4 / AC-F6-6 / NFR-4.) | 2026-07-03 |
| DEC-2 | The rule is a new standalone file (`.ai/rules/bulk-edit-verify.md`), not folded into another rule. | The issue allowed "new rule OR fold into `naming-and-types.md`", but no `naming-and-types.md` exists in `.ai/rules/`. No ambiguity. | 2026-07-03 |
| DEC-3 | Baseline agent load-set = `@coder` + `@pm` (when implementing directly) + `.ai/rules/README.md` index update. | Per the issue scope. `@fixer` is also exposed to the hazard but is deferred (§7.3 / OQ-1) to keep baseline scope tight. `@reviewer` already auto-loads `.ai/rules/` via its pre-flight and needs no dedicated change. | 2026-07-03 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.ai/rules/` catalog | New file added (`bulk-edit-verify.md`); existing files unchanged. |
| `.ai/rules/README.md` | Updated — one new index-table row. |
| `.opencode/agent/coder.md` | Updated — rule-loading section references the new rule. |
| `.opencode/agent/pm.md` | Updated — rule-loading section references the new rule (for when PM implements directly). |
| `.ados-claude/agents/` (generated) | Regenerated — mirrors the `.opencode/agent/` changes; committed alongside. |
| `scripts/install.sh` | Updated — one new entry in `ADOS_UPDATABLE_FILES`. |
| `scripts/.tests/test-doc-distribution.sh` | Updated — one new entry in `STANDALONE_DOCS`. |
| `scripts/uninstall.sh` | Updated — one new entry in `ADOS_LOCAL_STANDALONE_DOCS`. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the `.ai/rules/` catalog, **when** the bulk-edit-verify rule is added, **then** a file `bulk-edit-verify.md` exists and states a trigger that activates on any multi-file edit, any regex/`sed`/`replaceAll` substitution, or any find-and-replace over a path glob. | F-1 |
| AC-F2-1 | **Given** the rule, **when** an agent reads the verify section, **then** it finds a three-part verify gate phrased as MUST (not SHOULD/MAY) executed before commit: (a) `git diff --stat` to confirm the intended file set, (b) targeted grep for the substituted token, (c) for code, run the typecheck/compile gate. | F-2, NFR-1 |
| AC-F3-1 | **Given** the rule, **when** an agent reads the substring-overlap section, **then** it finds explicit instruction to grep for identifiers *containing* token A before substituting A→B and, on any unintended longer-identifier hit, to use word-boundary/anchored patterns or scoped paths — stated for both the pre-substitution (planning) and post-substitution (verify) stages. | F-3 |
| AC-F4-1 | **Given** verification reveals collateral damage, **when** the agent consults the recovery section, **then** it finds a MUST to revert the uncommitted edit (`git checkout -- <paths>`) and re-apply with safe substitutions, and an explicit prohibition on in-place counter-edits. | F-4 |
| AC-F1-2 | **Given** the rule, **when** reviewed, **then** it contains a one-way cross-link reference to #115 (large-artifact authoring policy). | F-1 |
| AC-F5-1 | **Given** the `@coder` agent definition, **when** its rule-loading section is read, **then** it references the bulk-edit-verify rule (directly or via the README index discovery protocol). | F-5 |
| AC-F5-2 | **Given** the `@pm` agent definition, **when** its rule-loading section is read, **then** it references the bulk-edit-verify rule for when PM implements directly. | F-5 |
| AC-F5-3 | **Given** `.ai/rules/README.md`, **when** the index table is read, **then** it contains a row for `bulk-edit-verify.md` with task/context and description. | F-5, DM-1 |
| AC-F6-1 | **Given** the new rule file, **when** the license-header script processes it, **then** the standard three-line MIT license header is present (applied via the sanctioned script, never by hand). | F-6 |
| AC-F6-2 | **Given** the new rule file, **when** its frontmatter is parsed, **then** it declares `ados_distribution: redistributable`. | F-6, NFR-2 |
| AC-F6-3 | **Given** `scripts/install.sh`, **when** `ADOS_UPDATABLE_FILES` is read, **then** it contains one entry for the new rule path. | F-6, DM-2, NFR-4 |
| AC-F6-4 | **Given** the drift-guard test, **when** `STANDALONE_DOCS` is read, **then** it contains one entry for the new rule path, identical to the installer entry. | F-6, DM-3, NFR-4 |
| AC-F6-5 | **Given** the new rule is installed and marked `redistributable`, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 (green). | F-6, NFR-2 |
| AC-F6-6 | **Given** `scripts/uninstall.sh`, **when** `ADOS_LOCAL_STANDALONE_DOCS` is read, **then** it contains exactly one entry for the new rule path, byte-identical to the install (DM-2) and guard (DM-3) entries. | F-6, DM-4, NFR-4 |
| AC-F5-4 | **Given** the `.opencode/agent/` sources were edited, **when** the generated-plugin-freshness check runs, **then** the `.ados-claude/agents/` mirrors are current (regenerated and committed alongside the source edits). | F-5, NFR-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Single change, single PR.** All artifacts (new rule, README index row, agent load-references, generated mirrors, installer entry, drift-guard entry) ship together so the distribution is internally consistent on merge.
- **Delivery order (high-level):** author the rule content (F-1 through F-4) → apply header + marker (F-6) → wire installer + drift-guard entries (F-6) → update README index + agent load-sections (F-5) → regenerate `.ados-claude/` mirrors (NFR-5) → verify the drift guard is green (NFR-2). The plan-writer will phase this.
- **Adoption:** adopting projects receive the new rule on their next `install.sh` run; no migration or breaking change for existing installs.
- **Communication:** the cross-link to #115 and the epic #107 context (drift detection & gate enforcement) connect this change to the broader safety theme.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persistent data, schemas, or seeded records are migrated. The only "state" changes are static list/array entries in the installer, drift-guard, and uninstaller (DM-2, DM-3, DM-4).

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — the change introduces a coding-process rule and static distribution wiring. It processes no personal data and has no compliance-regime implications.

## 21. SECURITY REVIEW HIGHLIGHTS

N/A — no security vulnerabilities are introduced or fixed. The rule improves code-corruption safety (process-level), which is a correctness/quality concern, not a security-control concern.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Rule maintenance:** the new rule is a static document; future edits follow the same header/marker/distribution contract. Because it is in `ADOS_UPDATABLE_FILES`, upstream changes to it are redistributed to adopting projects on their next install.
- **List-triple maintenance:** `ADOS_UPDATABLE_FILES` (install), `STANDALONE_DOCS` (drift guard), and `ADOS_LOCAL_STANDALONE_DOCS` (uninstall) are hand-synced per ODR-0001; any future rule redistribution must update all three, with guard mode 5 as the backstop for the install/guard pair. No automated test observes the uninstall list (RSK-6); its own "MUST stay in sync" comment + reviewer are the backstop. This change does not alter that maintenance contract — it exercises it once for the new rule.
- **No new runtime operations** — no new services, daemons, or scheduled jobs.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Bulk edit | Any edit touching >1 file in one operation, or any regex/`sed`/`replaceAll` substitution, or any find-and-replace over a path glob. |
| Substring-overlap hazard | When one identifier is a substring of another, an unanchored global substitution silently corrupts the longer identifier (e.g., substituting `foo` corrupts `foobar`). |
| Verify gate | The mandatory pre-commit sequence: diff-stat, targeted grep (incl. substring-overlap check), and typecheck/compile for code. |
| Clean revert | Recovery by `git checkout -- <paths>` on the uncommitted edit followed by re-application with safe substitutions — never an in-place counter-edit. |
| DM-2 | The closed scan scope of the drift guard: `doc/guides/*.md`, `doc/templates/**`, and five standalone docs (incl. `.ai/rules/README.md`). |
| `ados_distribution` | Frontmatter marker (`redistributable` \| `internal` \| `project-generated`) that drives the install set and the CI drift guard. |

## 24. APPENDICES

### Appendix A — Distribution wiring symmetry (why AC #4 implies installer + drift entries)

The installer currently installs ONLY `.ai/rules/README.md` from the rules catalog. A `redistributable` marker semantically promises "this is installed and guarded." Placing that marker on the new rule without an installer entry would make guard mode 3 (redistributable-not-installed) fire — the very drift the GH-67 guard exists to catch. Therefore the marker is only honest when paired with both the installer entry (so it is actually distributed) and the drift-guard entry (so the marker is enforced). This is why ticket AC #4 ("redistributable marker + license header") expands, in this spec, into AC-F6-1 through AC-F6-6 (AC-F6-6 closes the loop on uninstall so the new rule cannot become an orphaned file on adopting projects).

### Appendix B — Feature-spec coverage gap (advisory)

No `doc/spec/features/feature-ai-rules.md` documents the `.ai/rules/` catalog, the README discovery index, or how rule files are distributed. This change extends the distribution surface (one new standalone doc in DM-2) without such a spec. The gap is advisory — not a delivery blocker — and will be re-surfaced at system_spec_update (phase 7) by `@doc-syncer`'s `spec_coverage_gaps` field. See OQ-2.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | @spec-writer | Initial specification; incorporates PM decisions DEC-1/DEC-2/DEC-3 and the marker/install-truthfulness scope expansion. |
| 1.1 | 2026-07-03 | @spec-writer | DoR-iter-1 remediation: added DM-4 (`scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS`) — the third hand-synced distribution list the v1.0 spec missed; added AC-F6-6 (uninstall list entry byte-identical to install + guard); broadened NFR-4 from list-pair to list-triple sync; extended F-6 to name all three lists (install → guard → uninstall); added RSK-6 (no automated uninstall-list observer); added `uninstall.sh` to §16 affected components; propagated three-list framing through §7.1/§8.5/§19/§22 and front-matter dependencies; fixed singular→plural typo (`.ados-claude/agent/` → `.ados-claude/agents/`) throughout. |
| 1.2 | 2026-07-03 | @spec-writer | DoR-iter-3 advisory nit fixes (non-blocking, to remove self-contradiction): appended a supersede annotation to DEC-1 rationale noting the v1.1 three-list expansion (uninstall.sh `ADOS_LOCAL_STANDALONE_DOCS` per DM-4 / AC-F6-6 / NFR-4); corrected Appendix A AC range from "AC-F6-1 through AC-F6-5" to "AC-F6-1 through AC-F6-6" (added a clause that uninstall prevents orphaned files on adopting projects); corrected Authoring Guidelines AC range from "(AC-F6-1..5)" to "(AC-F6-1..6)". |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-112 (issue body), `chg-GH-112-pm-notes.yaml` (PM decisions DEC-1/DEC-2/DEC-3, feature-spec coverage note, cross-link note), and the authoritative reference files listed in the delegation context (`.ai/rules/README.md`, `.ai/rules/bash.md` as the canonical rule-file format, `scripts/install.sh` `ADOS_UPDATABLE_FILES`, `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS` + `get_marker()`, `.opencode/agent/coder.md`, `.opencode/agent/pm.md`, `.opencode/agent/reviewer.md` pre-flight, `doc/spec/features/feature-doc-distribution-marker.md`, `doc/spec/features/feature-license-header-script.md`).
- The three PM decisions were treated as settled (not re-litigated) and captured in the Decision Log and reflected in scope/ACs.
- The marker/install-truthfulness decision (DEC-1) was expanded into explicit ACs (AC-F6-1..6) because AC #4 of the ticket implies installer + drift-guard wiring — the spec makes that implication explicit and testable.
- File/component paths appear only as references to affected system components and distribution lists, not as implementation steps; the rule's *content* (trigger, verify, overlap check, recovery) is specified as functional requirements because the rule file is the product of this change.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-112)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, AC-, RSK-, DEC-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no step-by-step tasks, no code-level instructions)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
