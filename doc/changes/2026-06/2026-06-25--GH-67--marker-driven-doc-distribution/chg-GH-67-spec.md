---
workItemRef: GH-67
title: "Marker-driven doc distribution with install-manifest drift guard"
links:
  decisions: ["ODR-0001"]
  related_changes: ["GH-46"]
  benefits: ["GH-63", "GH-64", "GH-65", "GH-66"]
change:
  ref: GH-67
  type: refactor
  status: Proposed
  slug: marker-driven-doc-distribution
  title: "Marker-driven doc distribution with install-manifest drift guard"
  owners: ["Juliusz Ćwiąkalski"]
  service: doc-distribution
  labels: ["ci", "docs", "install", "guard", "odr-0001"]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: low
  dependencies:
    internal: ["scripts/install.sh", ".github/workflows/ci.yml", "scripts/.tests/", "AGENTS.md", ".ai/agent/pm-instructions.md", ".ai/agent/code-review-instructions.md"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the redistribution decision travel with each document via a frontmatter marker, derive the local-install set from that marker instead of a hand-maintained allowlist, and add a CI guard that fails on any drift — eliminating the entire class of "redistributable doc silently not installed" omissions.

## 1. SUMMARY

Replace the hand-maintained `ADOS_UPDATABLE_FILES` allowlist in `scripts/install.sh` with a frontmatter-marker-driven distribution system keyed by `ados_distribution: redistributable | internal | project-generated`. Install set becomes **derived** from markers (not hand-listed), templates are copied **recursively** (`*.md` + `*.yaml` + `blueprints/**`, per ODR-0001), and a new `scripts/.tests/test-doc-distribution.sh` guard fails on missing markers, invalid-marker-value, redistributable-not-installed, internal-installed, and derived-set drift — wired into `.github/workflows/ci.yml`. Process and reviewer hooks (`AGENTS.md`, `pm-instructions.md`, `code-review-instructions.md`) make the marker a first-class change requirement. Two same-class drive-by drift fixes to the install/uninstall tests are included.

## 2. CONTEXT

### 2.1 Current State Snapshot

ADOS is a template/framework repo: `scripts/install.sh` redistributes selected docs to adopting projects via the **local** install path (`--local`). Current mechanism (verified by audit):

- **Hand-maintained allowlist.** `ADOS_UPDATABLE_FILES` is a hard-coded array listing 5 standalone docs + 12 guides explicitly. There is no forcing function when a doc is added.
- **Templates copied non-recursively.** Templates are glob-copied via `doc/templates/*.md` only. Consequences (verified): `doc/templates/blueprints/` (5 files) is **never** installed, and `doc/templates/*.yaml` (4 register templates) is **never** installed.
- **The `ados_distribution` marker does not exist anywhere.** Verified: the only occurrence of the string `ados_distribution` in the entire repo is the ODR-0001 decision record prose. No document carries the applied marker.
- **No doc-distribution guard.** `scripts/.tests/test-doc-distribution.sh` does not exist. `.github/workflows/ci.yml` (41 lines) runs only a `.ados-claude/` idempotency check; there is a `# Future: Add additional quality gates here` placeholder.
- **Frontmatter is present on the 50 `.md` in-scope docs; the 4 `.yaml` register templates have none.** Verified: all 15 guides, all top-level `.md` templates, all blueprints, and all 5 standalone non-guide docs (`doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`) already open with a YAML frontmatter block (a 3-line `# Copyright` / `# MIT License` / `source:` header; the handbook additionally carries real keys `id`, `status`, `owners`, `summary`). The 4 `doc/templates/*.yaml` register templates start directly with data (no `---`-delimited block). The marker therefore uses a **two-path parser** (see §5.1 F-1.1): inside the existing frontmatter block for `.md` files; a top-level key at line 1 for `.yaml` files. No new frontmatter blocks are created on `.md` files, and no new license headers are required.

### 2.2 Pain Points / Gaps

- **Silent omissions (the incident).** GH-46 / PR #62 added `doc/guides/decision-making.md` (a primary redistributable guide) but it was never added to the manifest, so it would not install into any adopting project. Neither red-team round of #62 caught it.
- **No detection of wrong inclusions.** The hand-list cannot catch an internal guide being wrongly added.
- **Blueprint gap.** `doc/templates/blueprints/**` is documented as copyable (e.g. `code-review-instructions` blueprint tells adopters to copy it), but the non-recursive glob never installs it.
- **YAML register gap (ODR-0001).** The 4 `doc/templates/*.yaml` register templates are documented as "shared and versioned" in two places yet are silently undistributed.
- **Latent drift in the install test.** `scripts/.tests/test-install.sh` mock source and assertions omit `decision-making.md` even though it is in the manifest — a pre-existing inconsistency.
- **Stale fixture in the uninstall test.** `scripts/.tests/test-uninstall.sh` references a renamed-away fixture `system-dependencies.md` (the real guide is now `ados-tools-system-dependencies.md`).

## 3. PROBLEM STATEMENT

Because the local install set is derived from a hand-maintained allowlist with no forcing function, maintainers cannot reliably ensure every redistributable doc is installed and no internal doc leaks out — resulting in primary guides (e.g. `decision-making.md`) and whole template classes (blueprints, YAML registers) silently failing to install into adopting projects, with no CI or reviewer gate to catch the drift.

## 4. GOALS

- **G-1**: Make the redistribution classification travel with each document (frontmatter marker), so adding a doc forces a conscious choice and the install set is derived, not hand-maintained.
- **G-2**: Eliminate the drift class via a deterministic CI/test guard with defined failure modes.
- **G-3**: Close the audited gaps — recursive template install (blueprints) and YAML register install (ODR-0001).
- **G-4**: Add process and reviewer hooks so a missing marker / install-set update is caught at PR time.
- **G-5**: Preserve existing local-install behavior — idempotent and non-destructive for projects that already ran `install.sh --local`.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| In-scope docs carrying the `ados_distribution` marker | 54 / 54 (100%) |
| Redistributable docs actually installed | 51 / 51 (derived set == marker set) |
| Internal docs installed | 0 / 3 |
| Doc-distribution guard failure modes | 5 (missing-marker, invalid-marker-value, redistributable-not-installed, internal-installed, derived-set drift) |
| New external runtime dependencies introduced by the guard | 0 (pure POSIX/bash on the CI runner) |
| Re-run of `install.sh --local` on an existing project | additive-only, no destructive overwrites |

### 4.2 Non-Goals

- **NG-1**: Changing what counts as `project-generated` (`AGENTS.md`, `pm-instructions.md`, system specs, `doc/spec/**`, `doc/overview/**`, `doc/changes/**`) — these remain non-distributed and **out of scope** for marking in this change.
- **NG-2**: Redistributing the `tools/` CLI utilities or `doc/tools/*` guides (deferred — separate decision).
- **NG-3**: Marking `doc/changes/**` (frozen history) and individual `doc/decisions/*` records — only the stub `README.md` / `00-index.md` are in scope.
- **NG-4**: A web UI / dashboard for the manifest.
- **NG-5**: Rewriting the global-install path — only the **local** doc-distribution path is in scope.
- **NG-6**: Markdown-rendering / quality tooling.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | **Distribution marker as single source of truth** — an `ados_distribution` frontmatter key on every in-scope doc classifies it as `redistributable`, `internal`, or `project-generated`. | Forces a conscious classification per doc; decouples "what is it?" from "is it listed?". |
| F-2 | **Marker-derived local install set** — `install.sh` derives the installed guides from the marker; templates are copied recursively (`*.md` + `*.yaml` + `blueprints/**`). | Removes the hand-list drift surface; closes the blueprint and YAML-register gaps. |
| F-3 | **CI drift guard** — `test-doc-distribution.sh` fails on the five failure modes (incl. invalid marker value) and runs in CI. | The forcing function that makes drift impossible to merge. |
| F-4 | **Process + reviewer hooks** — `AGENTS.md`, `pm-instructions.md`, and `code-review-instructions.md` encode the marker requirement and a review checklist item. | Catches drift at authoring and PR time (the gate neither #62 red-team round had). |
| F-5 | **Curation & classification application** — apply markers per the authoritative classification table; observe ODR-0001; no hand-added license headers. | Turns the design into a concrete, auditable state. |
| F-6 | **Idempotent, non-destructive install** — re-running local install on an existing project only adds files; never destructively overwrites a tracked file. | Adoption safety; mandated by the ticket. |
| F-7 | **Drive-by drift fixes** — correct `test-install.sh` mock/assertions and `test-uninstall.sh` stale fixture. | Same drift class; cheap to close alongside. |

### 5.1 Capability Details

**F-1 — Marker model.** The marker is a single YAML key placed inside each in-scope doc's existing frontmatter block: `ados_distribution: <value>`. Exactly three values are valid:

| Value | Meaning | Local-installed? | Guard expectation |
|-------|---------|:----------------:|-------------------|
| `redistributable` | Generic framework doc/template, copied to every adopting project | Yes | Must be present in the derived install set |
| `internal` | ADOS-repo-only doc | No | Must NOT be in the install set |
| `project-generated` | Per-project, never copied | No | **Defined for completeness; out of scope to apply this change** (see NG-1) |

Missing marker on an in-scope doc ⇒ guard failure (the forcing function). The marker is the single source of truth; both the install derivation and the guard read from it.

**F-1.1 — Two-path parser (`.md` vs `.yaml`).** Because the 50 `.md` in-scope docs already carry a `---`-delimited frontmatter block while the 4 `.yaml` register templates do **not** (and must **not** get one), the marker is placed by a two-path parser keyed on file extension:

- `.md` files → `ados_distribution:` is inserted as a key **inside the existing frontmatter block** (no new block is created).
- `.yaml` files → `ados_distribution:` is added as a **top-level key at line 1** of the file (no `---`-delimited frontmatter block). Rationale: a `---` block would turn the file into a multi-document YAML stream, which breaks `yaml.safe_load()` consumers that read these registers as single documents.

A value outside the closed enum `{redistributable, internal, project-generated}` is rejected by the guard and treated like a missing marker (forcing-function consistency — see OQ-2, resolved).

**F-2 — Derived install.** The hand-listed guide entries are replaced by marker-driven globbing over `doc/guides/*.md` (install only those marked `redistributable`). Template handling changes from non-recursive `doc/templates/*.md` to recursive `doc/templates/**` covering `*.md`, `*.yaml`, and `blueprints/**`. The standalone non-guide redistributable docs remain explicit (they live outside the globbed classes) but are marker-checked by the guard.

**F-3 — Guard.** `test-doc-distribution.sh` computes (a) the marker-derived classification and (b) the install-derived set, then asserts invariants. It scans the in-scope file classes only (it must NOT scan `doc/changes/**`, `doc/spec/**`, `doc/overview/**`, individual `doc/decisions/*` records, or `AGENTS.md`).

**F-4 — Hooks.** Process docs state the marker is mandatory for any new/changed doc under `doc/` and that a change introducing a redistributable doc must pass the guard. The review checklist item targets new/changed docs under `doc/guides|templates` or the handbook.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Add a new redistributable guide (desired, post-change)
  Author adds doc/guides/new-guide.md with `ados_distribution: redistributable`
  → install.sh (local) derives it into the install set automatically (no manifest edit)
  → CI runs test-doc-distribution.sh: marker present, redistributable-is-installed ⇒ PASS
  → reviewer checklist confirms marker + guard pass
  → mergeable

Flow 2 — Forget the marker (the failure we now prevent)
  Author adds doc/guides/new-guide.md with no marker
  → CI: test-doc-distribution.sh "missing marker" mode ⇒ FAIL, blocks merge

Flow 3 — Accidentally mark an internal guide redistributable
  Author sets `ados_distribution: redistributable` on an ADOS-only guide
  → review checklist / guard catches the misclassification at PR time

Flow 4 — Existing project re-runs install.sh --local
  Adopter re-runs on a project that already installed prior ADOS version
  → additive: blueprints/, *.yaml registers, decision-making.md appear;
    upstream docs/templates are content-synced to the latest version;
    no adopter-generated working file is lost (idempotent, deterministic)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Add `ados_distribution` marker to every in-scope doc (see Classification Table §8.3).
- Replace the hand-listed guide entries in `install.sh` with marker-driven derivation; make template copy recursive (`*.md` + `*.yaml` + `blueprints/**`).
- Add `scripts/.tests/test-doc-distribution.sh` with the **five failure modes** — missing-marker, **invalid-marker-value** (value not in `{redistributable, internal, project-generated}`), redistributable-not-installed, internal-installed, derived-set drift — and wire into `.github/workflows/ci.yml`.
- Add process hooks (`AGENTS.md`, `.ai/agent/pm-instructions.md`) and the reviewer checklist item (`.ai/agent/code-review-instructions.md`).
- Two drive-by fixes: `test-install.sh` (include `decision-making.md` in mock + assertions); `test-uninstall.sh` (`system-dependencies.md` → `ados-tools-system-dependencies.md`).

### 7.2 Out of Scope

- [OUT] `tools/` CLI redistribution and `doc/tools/*` guides.
- [OUT] Marking `doc/changes/**` (frozen history) and individual `doc/decisions/*` records.
- [OUT] Applying `project-generated` markers to `AGENTS.md`, `pm-instructions.md`, `doc/spec/**`, `doc/overview/**` (they remain non-distributed and unmarked).
- [OUT] The global-install path; markdown/rendering tooling; a manifest UI.

### 7.3 Deferred / Maybe-Later

- Consider extending the marker to all `.ai/rules/*.md` (today only `.ai/rules/README.md` is in scope) if redistributable rules are added.
- The broader `tools/` redistribution question (ticket "Related").

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface.

### 8.2 Events / Messages

N/A — no event/message surface.

### 8.3 Data Model Impact

**DM-1 — `ados_distribution` marker key.** A scalar YAML key carrying one value from the closed, enforced enum `{redistributable, internal, project-generated}`. Placement follows the two-path parser (§5.1 F-1.1): inside the existing frontmatter block for `.md` files; a top-level key at line 1 for the 4 `.yaml` register templates (no `---` block). Contract: present on every in-scope doc; value drawn from the closed enum; the guard **enforces** the enum (any value outside the set is rejected and treated like a missing marker); authoritative for both install derivation and the guard.

**DM-2 — In-scope file classes.** The closed set of locations the marker + guard apply to:

| Class | Glob/Path | Marker required? |
|-------|-----------|:----------------:|
| Guides | `doc/guides/*.md` | Yes |
| Templates (md) | `doc/templates/*.md` | Yes |
| Templates (yaml) | `doc/templates/*.yaml` | Yes |
| Blueprints | `doc/templates/blueprints/**` | Yes |
| Handbook | `doc/documentation-handbook.md` | Yes |
| Doc index | `doc/00-index.md` | Yes |
| Decision stubs | `doc/decisions/README.md`, `doc/decisions/00-index.md` | Yes |
| Rules index | `.ai/rules/README.md` | Yes |

Everything outside DM-2 is **not** scanned (no marker required, not install-checked).

### Authoritative Classification Table

The coder and red-team treat this as the source of truth. **Total: 54 docs marked (50 `redistributable`, 1 `project-generated`, 3 `internal`).**

#### A. Guides (`doc/guides/*.md`) — 15 files

| # | File | Marker |
|---|------|--------|
| 1 | `change-lifecycle.md` | redistributable |
| 2 | `claude-code-setup.md` | redistributable |
| 3 | `copywriting.md` | redistributable |
| 4 | `decision-making.md` | redistributable |
| 5 | `decision-records-management.md` | redistributable |
| 6 | `external-researcher-setup.md` | redistributable |
| 7 | `meeting-preparation-and-summarization.md` | redistributable |
| 8 | `onboarding-existing-project.md` | redistributable |
| 9 | `opencode-agents-and-commands-guide.md` | redistributable |
| 10 | `opencode-model-configuration.md` | redistributable |
| 11 | `pr-platform-integration.md` | redistributable |
| 12 | `unified-change-convention-tracker-agnostic-specification.md` | redistributable |
| 13 | `adding-tool-support.md` | **internal** |
| 14 | `ados-tools-system-dependencies.md` | **internal** |
| 15 | `tools-convention.md` | **internal** |

> Note: the ticket body's "(13)" redistributable-guide count is a typo; the enumeration above (12) is authoritative (per PM validation).

#### B. Templates — `doc/templates/*.md` (25, all redistributable)

`business-experiment-template.md`, `business-model-template.md`, `business-north-star-template.md`, `business-validation-plan-template.md`, `change-spec-template.md`, `content-strategy-template.md`, `customer-problem-template.md`, `customer-success-strategy-template.md`, `decision-record-template.md`, `documentation-profile-template.md`, `feature-spec-template.md`, `ideal-customer-profile-template.md`, `implementation-plan-template.md`, `jobs-to-be-done-template.md`, `meeting-notes-template.md`, `north-star-metric-template.md`, `north-star-template.md`, `persona-template.md`, `pr-instructions-template.md`, `product-roadmap-template.md`, `README.md`, `sales-strategy-template.md`, `strategic-assumptions-template.md`, `test-plan-template.md`, `test-spec-template.md`.

#### C. Templates — `doc/templates/*.yaml` (4, all redistributable, per ODR-0001)

`content-calendar-template.yaml`, `experiment-register-template.yaml`, `metric-catalog-template.yaml`, `product-roadmap-register-template.yaml`.

#### D. Blueprints — `doc/templates/blueprints/**` (5, all redistributable)

`code-review-instructions--example.md`, `decision-instructions--example.md`, `pr-instructions--github-cli.md`, `pr-instructions--github-mcp.md`, `pr-instructions--gitlab-cli.md`.

#### E. Standalone non-guide docs (5: 4 `redistributable`, 1 `project-generated`)

| # | File | Marker |
|---|------|--------|
| 1 | `doc/documentation-handbook.md` | redistributable |
| 2 | `doc/00-index.md` | redistributable |
| 3 | `doc/decisions/README.md` | redistributable |
| 4 | `doc/decisions/00-index.md` | **project-generated** |
| 5 | `.ai/rules/README.md` | redistributable |

> **PR #74 review C3 (owner directive):** `doc/decisions/00-index.md` is reclassified `redistributable` → `project-generated`. It is regenerated per-repo (by the script tracked under GH-63), so it is NOT copied by `install.sh` and is excluded from the derived install set. It is still marker-scanned by the drift guard (DM-2).

> Frontmatter note (verified): the 50 `.md` files in A–E already carry a frontmatter block; the 4 `.yaml` register templates (Class C) do **not**. The marker uses the two-path parser (§5.1 F-1.1): inserted into the existing frontmatter block for `.md` files; added as a top-level key at line 1 for the 4 `.yaml` files. **No new frontmatter blocks are created on `.md` files, and no new license/copyright headers are added** (headers stay managed solely by `scripts/add-header-location.sh` on its configured paths).

### 8.4 External Integrations

N/A — runs on the standard GitHub Actions `ubuntu-latest` runner with no third-party APIs.

### 8.5 Backward Compatibility

- **Additive only.** Local install gains files previously undistributed (blueprints, 4 YAML registers, `decision-making.md`); no existing tracked file is removed or destructively overwritten.
- **Marker-only edits to docs.** Adding a single marker key (frontmatter key for `.md`; top-level key for `.yaml`) to existing files does not alter rendered content.
- **`.ados-claude/` plugin is unaffected** unless a `.opencode/` file is edited (none expected in this change); no regeneration required.
- **Guard is new**, so it cannot break pre-existing local behavior; it only blocks future drift on push/PR.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Guard determinism — the same repo state yields the same pass/fail verdict across repeated runs | 100% reproducible (no time/randomness/ordering dependence) |
| NFR-2 | Guard + local install performance over the ~54 in-scope files | Completes in < 5 s wall-clock on `ubuntu-latest`; no network calls |
| NFR-3 | Boundary — only the local doc-distribution path changes; the global-install path is untouched | Zero edits to global-install behavior |
| NFR-4 | Zero new runtime dependencies for the guard | Pure POSIX tools available on the CI runner (bash/git/grep/sed/awk); no `npm`/`pip`/YAML library install |
| NFR-5 | Idempotency — re-running `install.sh --local` on an existing project is deterministic and non-destructive | Second run produces a deterministic result; no loss of adopter-generated working files — only upstream-tracked docs/templates are re-synced to the latest version (content-sync); never deletes |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The guard must emit a clear, machine- and human-readable failure message naming the offending file(s) and the failed condition (which of the five modes) to CI logs, with `::error::` annotations where supported.
- No runtime metrics/logs/alerts beyond CI step output (this is a repo-internal build gate).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Marker parse fragility — frontmatter blocks contain comment lines (`# Copyright`) and (handbook) real keys; a naive parser misreads `ados_distribution` | M | L | Define a precise parse rule for the key within the existing block; add guard self-tests for the mixed-content handbook file | L |
| RSK-2 | Guard scope too broad — scans out-of-scope dirs (`doc/changes`, `doc/spec`, `doc/overview`) and fails on legitimately unmarked project-generated files | M | M | Restrict the scan to the closed DM-2 class set; assert the guard passes on the current repo as-is | L |
| RSK-3 | Guard scope too narrow — misses a new doc class, letting drift escape | H | L | Derive the scanned set from the same glob roots as install; cover all five modes in tests | L |
| RSK-4 | Recursive/extended glob changes install layout destructively for existing projects | H | L | Reuse the additive, idempotent copy primitive; mandate NFR-5 / AC-F6-1 | L |
| RSK-5 | Engineering-repo installs surprised by 4 new YAML files + blueprints | L | L | Additive only; adopters ignore unused templates (per ODR-0001 driver 5) | L |
| RSK-6 | Marker typo (e.g. `redistibutable`) silently misclassifies a doc | M | M | Guard rejects values outside the enum `{redistributable, internal, project-generated}` (OQ-2 resolved YES); invalid value fails like a missing marker | L |

## 12. ASSUMPTIONS

- The 50 `.md` in-scope docs already have a frontmatter block; the 4 `.yaml` register templates do not (and must not — a `---` block would create a multi-document YAML stream that breaks `yaml.safe_load()`). The marker is inserted into the existing block for `.md` and added as a top-level key at line 1 for `.yaml` (two-path parser, §5.1 F-1.1).
- The 4 YAML register templates contain no repo-specific ticket numbers, tracker refs, or private references (verified by grep in ODR-0001, satisfying the redistributability constraint C-3).
- Profile governs **usage**, not **distribution** (established repo convention, per ODR-0001): profile-optional templates are already distributed today.
- `copy_updatable_file` **content-syncs** updatable files — it re-syncs pristine upstream docs/templates to the latest version; additive for new files; never deletes (verified against the live `install.sh` behavior). It is idempotent. Adopters copy templates to working locations rather than editing templates in place. *(Templates are references — copy to a working file before filling in.)*
- The GitHub ticket's 9 ACs and the audited counts are the authoritative inputs; the "(13)" guide count is a typo (12 is correct).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | ODR-0001 (Accepted) | Classifies the 4 `*.yaml` registers `redistributable` — scope the glob + guard to `*.yaml` accordingly |
| Depends on | GH-46 / PR #62 | Adds `decision-making.md`; the one-line manifest fix lands on the #62 branch first; this change then replaces the hand-list |
| Blocks | GH-63, GH-64, GH-65, GH-66 | These add distributable docs and rely on this guard to stay correct |
| Related | `tools/` redistribution | Deferred — separate decision |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Can the marker be parsed reliably with POSIX tools given the mixed frontmatter (comment lines + real keys in the handbook)? | NFR-4 forbids a YAML library; RSK-1 captures the fragility. | To confirm in delivery (feasibility check for the coder) |
| OQ-2 | Must the guard also reject an **invalid** marker value (not one of the three enum values)? | The ticket lists 4 failure modes but not enum validation; a typo would silently misclassify (RSK-6). | **Resolved — PM-decided YES (2026-06-25).** The guard validates the marker against the closed enum `{redistributable, internal, project-generated}`; an invalid value is treated like a missing marker (forcing-function consistency). The ticket's 4 failure modes become 5. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt ODR-0001: classify the 4 `doc/templates/*.yaml` register templates `redistributable`; extend the glob + guard to `*.yaml` | Closes the documented-shared-but-not-installed drift; uniform with `.md` template class; additive and reversible | 2026-06-25 |
| DEC-2 | Template scope = `*.md` + `*.yaml` + `blueprints/**` (recursive) | Fixes the non-recursive blueprint gap; YAML per ODR-0001 | 2026-06-25 |
| DEC-3 | Include the two drive-by test drift fixes | Same drift class as the primary change; cheap and coherent | 2026-06-25 |
| DEC-4 | Guard validates the marker against the closed enum `{redistributable, internal, project-generated}`; an invalid value is rejected and treated like a missing marker (resolves OQ-2 → YES) | Closes RSK-6 (marker typo silently misclassifies); forcing-function consistency; brings failure-mode count to 5 | 2026-06-25 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `scripts/install.sh` | Updated (marker-derived guides; recursive templates incl. `*.yaml`) |
| `scripts/.tests/test-doc-distribution.sh` | New (the guard) |
| `scripts/.tests/test-install.sh` | Updated (drive-by: include `decision-making.md`) |
| `scripts/.tests/test-uninstall.sh` | Updated (drive-by: stale fixture rename) |
| `.github/workflows/ci.yml` | Updated (run the guard) |
| `doc/guides/**` (15), `doc/templates/**` (34), 5 standalone docs | Updated (marker added: frontmatter key for `.md`; top-level key at line 1 for the 4 `.yaml` registers) |
| `AGENTS.md`, `.ai/agent/pm-instructions.md` | Updated (process hook) |
| `.ai/agent/code-review-instructions.md` | Updated (reviewer checklist item) |
| `.ados-claude/` | Unchanged (no `.opencode/` edit expected) |

## 17. ACCEPTANCE CRITERIA

> Grouped by area; Given/When/Then; each links to at least one F-/DM-/NFR-. Expands the ticket's 9 ACs into precise, testable conditions.

### A. Marker presence & classification (F-1, F-5, DM-1, DM-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the 15 files in `doc/guides/`, **when** the guard scans `doc/guides/*.md`, **then** every file carries an `ados_distribution` marker whose value matches §8.3 Table A (exactly 12 `redistributable`, 3 `internal`). | F-1, F-5, DM-2 |
| AC-F1-2 | **Given** the template set, **when** scanned, **then** all 25 `doc/templates/*.md`, all 4 `doc/templates/*.yaml`, and all 5 `doc/templates/blueprints/**` files carry `ados_distribution: redistributable` (Tables B–D). | F-1, F-5, DM-2 |
| AC-F1-3 | **Given** the 5 standalone non-guide docs (`doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`), **when** scanned, **then** each carries a valid `ados_distribution` marker — 4 `redistributable` and `doc/decisions/00-index.md` `project-generated` (Table E; PR #74 review C3). | F-1, F-5, DM-2 |
| AC-F1-4 | **Given** any in-scope doc (DM-2 classes), **when** it lacks the `ados_distribution` marker, **then** `test-doc-distribution.sh` exits non-zero with a message naming the file. | F-1, F-3, DM-1 |

### B. Marker-derived local install (F-2, F-5, DM-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** `install.sh` local mode, **when** run, **then** the installed guide set equals the 12 `redistributable`-marked guides derived from markers (the hand-listed guide entries are no longer the source of truth). | F-2 |
| AC-F2-2 | **Given** templates, **when** installed, **then** `install.sh` copies `doc/templates/*.md` AND `doc/templates/*.yaml` AND `doc/templates/blueprints/**` recursively — i.e. blueprints and the 4 YAML registers are installed (per ODR-0001 / DEC-1). | F-2, F-5 |
| AC-F2-3 | **Given** the 3 `internal` guides (`adding-tool-support.md`, `ados-tools-system-dependencies.md`, `tools-convention.md`), **when** `install.sh` runs, **then** none is installed. | F-2, DM-1 |
| AC-F2-4 | **Given** `decision-making.md` and `decision-records-management.md`, **when** `install.sh` runs, **then** both install (closing the #62 omission). | F-2 |

### C. Guard behavior & CI wiring (F-3, NFR-1, NFR-2, NFR-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a `redistributable` doc not in the install-derived set, **when** the guard runs, **then** it fails (mode: redistributable-not-installed). | F-3 |
| AC-F3-2 | **Given** an `internal` doc present in the install set, **when** the guard runs, **then** it fails (mode: internal-installed). | F-3 |
| AC-F3-3 | **Given** the install-derived set ≠ the marker-derived set (drift), **when** the guard runs, **then** it fails (mode: derived-set drift). | F-3, NFR-1 |
| AC-F3-4 | **Given** the guard scans templates, **when** it enumerates install-candidate templates, **then** it scans BOTH `*.md` AND `*.yaml` (and `blueprints/**`) per ODR-0001. | F-3, F-5 |
| AC-F3-5 | **Given** `.github/workflows/ci.yml`, **when** CI runs on push/PR, **then** `test-doc-distribution.sh` executes and a failure blocks merge (non-zero step exit). | F-3 |

### D. Process & reviewer hooks (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** `AGENTS.md` and `.ai/agent/pm-instructions.md`, **when** read, **then** both state that any new/changed doc under `doc/` MUST declare `ados_distribution`, and that a change introducing a redistributable doc MUST pass `test-doc-distribution.sh`. | F-4 |
| AC-F4-2 | **Given** `.ai/agent/code-review-instructions.md`, **when** read, **then** it contains a checklist item requiring verification of the `ados_distribution` marker (present + correct) for new/changed docs under `doc/guides|templates` or the handbook, and confirmation that the guard passes when the doc is `redistributable`. | F-4 |

### E. Backward compatibility & header hygiene (F-5, F-6, NFR-3, NFR-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a project that already ran `install.sh --local`, **when** `install.sh --local` is re-run, **then** the run is idempotent and non-destructive — no loss of adopter-generated working files; only upstream-tracked docs/templates are re-synced to the latest version (content-sync); re-running produces a deterministic result. | F-6, NFR-5 |
| AC-F5-1 | **Given** license headers and frontmatter, **when** the change is delivered, **then** (a) no copyright/license header is hand-added — headers remain managed solely by `scripts/add-header-location.sh` on configured paths; (b) **for `.md` files only**, the marker is inserted into the existing frontmatter block and **no new frontmatter block is created** — the 4 `.yaml` register templates legitimately receive `ados_distribution` as a new top-level key (NOT a frontmatter block, to avoid a multi-document YAML stream); `.ados-claude/` is regenerated only if `.opencode/` is edited (none expected). | F-5, NFR-3 |

### F. Drive-by drift fixes (F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** `scripts/.tests/test-install.sh`, **when** it builds its mock ADOS source and its guide assertions, **then** `decision-making.md` is included in both (fixing the latent drift where it was omitted despite being in the manifest). | F-7 |
| AC-F7-2 | **Given** `scripts/.tests/test-uninstall.sh`, **when** it references the system-dependencies fixture, **then** it uses `ados-tools-system-dependencies.md` (not the stale `system-dependencies.md`). | F-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Land after PR #62 merges (the one-line `decision-making.md` manifest fix rides #62 so it does not merge broken).
2. Deliver marker application, install derivation, and the guard together (single change) so the guard is green at merge.
3. Verify the guard passes on the current repo as the green baseline before enabling it as a merge gate.
4. Communicate the marker requirement to maintainers via the `AGENTS.md` / `pm-instructions.md` hook (internal audience) and note the additive install change for adopters (external audience).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data. The only "state" is frontmatter in docs and the derived install set, both reconciled by the change itself. Existing local installs are updated additively on the next `install.sh --local` run.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal data is processed. ODR-0001 confirms the 4 YAML registers contain no repo-specific/private references and are safe to redistribute (constraint C-3).

## 21. SECURITY REVIEW HIGHLIGHTS

- The guard and install path run with POSIX tools only; no code execution from untrusted input.
- Redistributability constraint (no private/repo-specific refs in redistributed files) is preserved by ODR-0001's verified audit and re-enforced by the guard's classification model.
- No new secrets, tokens, or credentials involved.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing:** adding a redistributable doc becomes a 1-key frontmatter edit (no manifest edit); the guard keeps the set correct automatically — the maintenance burden that motivated this change is removed.
- **Operations:** one new CI step; negligible runtime (< 5 s, NFR-2). Failures are diagnosable via the guard's named-condition output (§10).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| `ados_distribution` marker | Frontmatter key classifying a doc as `redistributable`, `internal`, or `project-generated`; single source of truth for distribution. |
| Redistributable | Generic framework doc/template copied to every adopting project. |
| Internal | ADOS-repo-only doc; not installed. |
| Project-generated | Per-project doc; never copied (defined for completeness; out of scope to apply here). |
| Drift | Any mismatch between the marker-derived classification and the install-derived set (or a missing marker). |
| Guard | `scripts/.tests/test-doc-distribution.sh` — the CI-enforced drift detector. |
| Local install | `install.sh --local` — the doc-distribution path in scope (vs. the out-of-scope global path). |

## 24. APPENDICES

- **Appendix A — Counts.** Docs marked: 54 total = 50 `redistributable` + 1 `project-generated` + 3 `internal`. Derived install set: 50 files (`project-generated` is not installed). Classes: 15 guides, 25 md-templates, 4 yaml-templates, 5 blueprints, 5 standalone docs.
- **Appendix B — Source inputs.** GitHub issue GH-67; ODR-0001 (Accepted); verified repo audit (install.sh manifest L76–99 & template glob L677; ci.yml; absence of test-doc-distribution.sh; test-install.sh mock/assertions omitting `decision-making.md`; test-uninstall.sh stale `system-dependencies.md`; the 50 `.md` in-scope docs confirmed to have frontmatter, and the 4 `.yaml` register templates confirmed to have **no** frontmatter block).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | @spec-writer | Initial specification for GH-67 |
| 1.1 | 2026-06-25 | @spec-writer | Red-team revisions: (CRIT-1) two-path marker parser — `.md` frontmatter key vs `.yaml` top-level key (no false "all 54 have frontmatter" claim); (MAJ-1) OQ-2 resolved — guard enforces the closed enum, 5 failure modes; (MAJ-3) `copy_updatable_file` is content-sync (not create-if-absent); NFR-5/AC-F6-1/Flow 4 corrected; AC-F5-1 re-scoped to `.md` only; DEC-4 added. |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue GH-67 (primary input, read via `gh issue view`); ODR-0001 (Accepted decision, incorporated as fact); `doc/templates/change-spec-template.md` (structure); `doc/guides/unified-change-convention-tracker-agnostic-specification.md` (naming/conventions); PM-validated context in the request.
- Every quantitative claim about the current repo state was independently verified via the audit (file listings, install.sh manifest/glob lines, ci.yml, the two test files, and frontmatter presence across all 54 in-scope docs) rather than taken on faith.
- The classification table (§8.3) is the single authoritative file list for the coder and red-team; the ticket's "(13)" guide count was corrected to 12 per PM validation.
- Frontmatter caveat from the request ("standalone docs may lack frontmatter") was refined via red-team: the 50 `.md` in-scope docs carry frontmatter (marker inserted into the existing block), but the 4 `.yaml` register templates do **not** — they receive the marker as a top-level key at line 1 (two-path parser, §5.1 F-1.1). No new frontmatter blocks are created on `.md` files; no new license headers are added.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-67)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths as instructions, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
