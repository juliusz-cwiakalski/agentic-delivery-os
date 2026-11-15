---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-doc-distribution-marker.md
ados_distribution: internal
id: SPEC-DOC-DISTRIBUTION-MARKER
status: Current
created: 2026-06-28
last_updated: 2026-11-15
owners: ["engineering"]
service: delivery-os
summary: "The ados_distribution marker system: three values, a two-path parser, a marker-derived install set, a five-mode CI drift guard, and the closed DM-2 scan scope (which excludes doc/spec/**)."
links:
  related_changes: ["GH-79", "GH-67", "GH-320"]
---

# Feature: Doc Distribution Marker

## Overview

ADOS is a template/framework repo: `scripts/install.sh` redistributes selected docs to adopting projects. The `ados_distribution` frontmatter marker (`redistributable | internal | project-generated`) is the **single source of truth** for classification, from which the install set and a CI drift guard are both derived — replacing a hand-maintained allowlist. This spec covers the marker values, the two-path parser, the derived install set, the five-mode guard, and the closed scan scope.

> **Marker system delivered by GH-67; record semantics anchored by ODR-0001.** This spec documents the system as built; the delivering change is **GH-67**, and the ambiguous-classification case (YAML register templates) is resolved by [ODR-0001](../../decisions/ODR-0001-classify-yaml-register-templates-redistributable.md). Installer behavior beyond the launcher registration documented below remains out of scope here.

## Business Context

### Problem Statement

- **Problem:** A hand-maintained install allowlist drifts from reality — files documented as "shared/versioned" go silently undistributed, and the guard cannot detect the gap.
- **Affected Users:** Adopters who install ADOS docs; maintainers who must keep the install set honest.
- **Business Impact:** Drift erodes trust in the install set and the CI guard; adopters miss documented templates.

### Goals & Success Metrics

- **Primary Goal:** Eliminate the drift class by deriving the install set + guard from one marker source of truth.
- **KPIs:** The CI guard (`scripts/.tests/test-doc-distribution.sh`) passes on the green baseline and fails on each of the five drift modes.

## The launcher registration in the install set

The local install set is the marker-derived document set plus the delivery scripts, the delivery tools, the template files, and the plugin projection. It also registers one executable launcher outside the project tree, at the brand install path the executable itself declares (`~/.jaiship/bin/jaiship` for the `jaiship` identity). That launcher is not a redistributable document and is not a template, so it is not part of the marker-derived set and the guard's document rules are unchanged; it is a declared installer step:

- **Target:** exactly one absolute path, the installed source tree's CLI entry, recorded at install time and rendered as a single safely quoted shell word, so a source path containing a single quote, a backslash, or a space still yields a syntactically valid launcher that execs exactly that target.
- **Path authority:** the installer reads the path from the executable's state-free `--print-install-path` self-description with the working-name override removed from that child's environment, and expands only the leading home marker. It composes no name-derived path in bash.
- **Idempotence:** re-running an unchanged install rewrites nothing; a different source repoints the launcher.
- **Missing target:** one bounded stderr line naming the expected target and the remedy, with a non-zero exit.
- **Install-time runtime requirement:** the Bun runtime must be resolvable at install time. A missing runtime, or a resolved source tree without the CLI entry, is a classified failure naming what is missing, with a non-zero exit and no launcher written — never a silent skip. `DRY_RUN` (or `--dry-run`) is a plan-only preview: it evaluates no install-time precondition, writes nothing, prints one plan line naming the CLI entry it would record, and exits `0`, including from a source tree without the CLI entry; the classified failures apply to a real run only. The step is independent of `--tool`.
- **Unchanged:** the delivery script array, the delivery tool array, the template set, the hook examples, the plugin projection, and the `delivery-os` bin mapping. No `delivery-os` launcher is registered and no uninstall path exists.

The operator-facing description is the [Local Install and Prior-Identity Transition](../../guides/local-install.md) guide.

## User Experience & Functionality

### Capabilities

- **Three marker values (F-1):** `ados_distribution` accepts exactly:
  - `redistributable` — installed and guarded (safe to redistribute to adopting projects; contains no repo-specific refs).
  - `internal` — NOT installed (ADOS-only development asset); if it appears in the install set, the guard fails.
  - `project-generated` — marker-checked for validity but NOT installed (e.g., generated indexes like `doc/decisions/00-index.md`).
- **Two-path parser (F-2):** A single `get_marker()` parser (mirrored exactly between `install.sh` and the guard) reads the marker differently by file type:
  - **`.md`** — only the **first `---` frontmatter block** (line 1 must be `---`); within it match `^ados_distribution:` (skipping commented `#` lines); body/second-block occurrences are ignored. Quote stripping + CRLF tolerance included.
  - **`.yaml`/`.yml`** — a **top-level** `^ados_distribution:` key anywhere (column-0 anchored); a `---` block would break `yaml.safe_load()` consumers, so YAML uses no frontmatter block. Indented (non-top-level) keys are ignored.
- **Derived install set (F-3):** The EXPECTED install set is derived marker-aware:
  - **Guides** — only `redistributable`-marked guides install (marker-filtered).
  - **Templates** (`doc/templates/**`, `.md` and `.yaml`) — installed **wholesale** by recursive glob (not marker-filtered); their markers are still enforced for presence/validity.
  - **Standalone docs** — marker-aware: only `redistributable`-marked standalone docs install (`project-generated` is excluded).
- **Five-mode drift guard (F-4):** `scripts/.tests/test-doc-distribution.sh` is an **independent oracle** — the EXPECTED set is derived from markers + rule; the ACTUAL set is observed from a real sandbox `install.sh --local` run (only `get_marker()` is shared). It fails on five modes:
  1. **missing-marker** — an in-scope doc with no marker.
  2. **invalid-enum-value** — value not in the closed enum.
  3. **redistributable-not-installed** — a redistributable doc absent from the install set.
  4. **internal-installed** — an internal doc present in the install set.
  5. **derived-set drift** — marker-derived install set ≠ sandbox install set.
- **Closed DM-2 scan scope (F-5):** The guard scans a **closed set**: `doc/guides/*.md`, `doc/templates/**` (`.md` + `.yaml`), and five standalone docs (`doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`). It **explicitly excludes `doc/spec/**`** — feature specs are outside the marker/guard automation surface.

### Honesty consequence for feature specs

Because `doc/spec/**` is outside DM-2, an `ados_distribution` marker on a feature spec is **honest but unenforced** — it classifies for forward consistency but the guard does not scan it, and `install.sh` creates `doc/spec/features/` only as an **empty stub** (`ADOS_LOCAL_DIRS`). Hence new feature specs use `internal` (the honest classification: content is not redistributed) without affecting the guard. Extending DM-2 to `doc/spec/features/**` is a deferred option (see change spec GH-78 §7.3, OQ-2).

### User Flows

```
Add a redistributable guide  → marker in frontmatter → guard verifies installed + marker-valid
Mark an internal guide        → marker in frontmatter → guard verifies NOT installed
Add a new standalone doc      → must be in STANDALONE_DOCS + carry a valid marker or guard fails (mode 1/2)
```

### Edge Cases & Error Handling

- **Commented marker line** inside the first frontmatter block → parsed as `missing` (mode 1).
- **Marker only in a second `---` block** or in the body → parsed as `missing`.
- **Quoted/CRLF marker value** → quote-stripped to the bare enum; CRLF tolerated.
- **bash < 4** (no `globstar`) → the guard fails loudly with an actionable message rather than silently under-scanning.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `scripts/.tests/test-doc-distribution.sh` | Drift guard (CI) | 5-mode independent oracle; `get_marker()` parser + self-tests + expected/actual set comparison |
| `scripts/install.sh` | Installer | Derives the install set from markers (`ADOS_UPDATABLE_FILES`, `ADOS_LOCAL_DIRS`); creates `doc/spec/features/` as an empty stub |
| `doc/decisions/ODR-0001-...redistributable.md` | Decision record | Resolves the ambiguous `.yaml` register-template classification as `redistributable` |

### Parser Internals

The `get_marker()` parser is **shared** between `install.sh` and the guard (the guard reimplements the set derivation so the oracle is not tautological). It is covered by inline self-tests (`.md` + `.yaml` positive/negative/commented/second-block/CRLF/quoted cases).

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Drift elimination | Marker is the single source of truth for the install set | Guard green on baseline; fails on each of 5 modes |
| NFR-2 | Parser correctness | Two-path parser handles `.md` frontmatter vs `.yaml` top-level key | Self-tests pass (7 `.md` + 4 `.yaml` cases) |
| NFR-3 | Honest classification | Feature specs (`doc/spec/**`) carry `internal` and are not guard-enforced | DM-2 excludes `doc/spec/**` |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| CI | Guard green | `bash scripts/.tests/test-doc-distribution.sh` |
| CI | Modes harness | `bash scripts/.tests/test-doc-distribution-modes.sh` exercises each of the 5 failure modes on a synthetic tree |
| Bun test job | Launcher step | `bun test tests/structure/install-launcher.test.ts tests/checks/install-launcher-installer.test.ts` — registration structure, path authority, content idempotence, repointing, the classified failures, and `--version` from outside the repository |
| Manual | Install set | `install.sh --local` in a sandbox; compare against marker-derived set |

## Dependencies & Risks

- **Delivered by:** GH-67 (marker system + install-set derivation + CI guard).
- **Anchored by:** [ODR-0001](../../decisions/ODR-0001-classify-yaml-register-templates-redistributable.md) (YAML register classification).
- **Related (out of scope):** GH-77 (installer spec) — cross-linked TBD; not delivered here.
- **Risk:** `doc/spec/**` is outside the guard, so feature-spec markers are honest-but-unenforced — mitigated by the explicit DM-2 exclusion and the deferred DM-2-extension option.

## Related Documentation

- **Drift guard (authoritative):** `scripts/.tests/test-doc-distribution.sh`.
- **Modes harness:** `scripts/.tests/test-doc-distribution-modes.sh`.
- **Installer:** `scripts/install.sh` (`ADOS_LOCAL_DIRS`, `ADOS_UPDATABLE_FILES`).
- **Decision record:** [ODR-0001](../../decisions/ODR-0001-classify-yaml-register-templates-redistributable.md) — classify YAML register templates `redistributable`.
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — "Doc distribution marker" (the marker rule + DM-2 enumeration).
- **Delivering change:** GH-67 (marker system).
- **Cross-link (TBD / out of scope):** GH-77 (installer spec) — the natural home for installer-behavior documentation; not delivered in this change.
