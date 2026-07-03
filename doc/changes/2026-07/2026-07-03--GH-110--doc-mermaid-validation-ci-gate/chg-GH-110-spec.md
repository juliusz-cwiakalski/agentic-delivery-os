---
ados_distribution: project-generated
id: CHG-GH-110
links:
  decisions: []
  epic: ["GH-107"]
  related_changes: ["GH-67"]
  spec: []   # new feature area — none exists; authored at phase 7 (see §13, PM decision #5)
change:
  ref: GH-110
  type: feat
  status: Proposed
  slug: doc-mermaid-validation-ci-gate
  title: "Doc & mermaid validation CI gate"
  owners: ["Juliusz Ćwiąkalski"]
  service: doc-validation
  labels: ["ci", "docs", "mermaid", "guard", "drift-detection", "epic-107"]
  version_impact: minor
  audience: internal
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["scripts/test-all.sh", "scripts/build-claude-plugin.sh", "scripts/.tests/test-doc-distribution.sh", ".ai/rules/bash.md", ".ai/rules/README.md", ".github/workflows/ci.yml", ".opencode/agent/spec-writer.md", ".opencode/agent/doc-syncer.md", ".opencode/agent/bootstrapper.md"]
    external: ["@mermaid-js/mermaid-cli (mmdc)", "puppeteer/chromium (transitive)"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Add the first automated guardrail over `doc/**` — a headless mermaid render validator plus a CI gate and an authoring rule — so a broken diagram block is caught at authoring time and at PR time, eliminating the class of "gate-approved doc ships an unrenderable diagram" defects.

## 1. SUMMARY

This change introduces a mermaid validation capability for documentation-only surfaces, which today have **zero** automated checks. It delivers four things: (1) `scripts/validate-mermaid.sh` — extracts every ` ```mermaid ` fenced block from `.md` files across the doc tree and renders each headless via `@mermaid-js/mermaid-cli` (`mmdc`), exiting non-zero on any parse/render failure with file + block index + first error; (2) a dedicated, benign CI workflow `docs (mermaid validate)` triggered only on doc-path changes; (3) `.ai/rules/diagrams.md` — a statement that all Mermaid families are allowed (including C4, which GitHub renders — DEC-8) with a render-gate self-check; and (4) a concise authoring self-check wired into the three doc-authoring agent prompts that actually emit mermaid blocks. Markdownlint (listed optional in the ticket, no AC) is an explicit non-goal.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **No `doc/**` validation exists.** `.github/workflows/ci.yml` (70 lines, three jobs: `verify-claude-build`, `doc-distribution-guard`, `inception-doc-consistency`) has **no `paths:` filter** and scopes to generated-plugin freshness + the doc-distribution/inception guards. Markdown and mermaid are completely unvalidated. (Verified: the CI workflow is "pre-code-resilient" — it does not compile source — yet it still inspects no rendered doc content.)
- **No mermaid validator or diagrams rule exists.** `scripts/validate-mermaid.sh` and `.ai/rules/diagrams.md` are absent (verified). `.ai/rules/` holds `README.md`, `bash.md`, `installer.md`, `testing-strategy.md` only.
- **Mermaid is already in the doc tree.** Audit (```mermaid``` fenced blocks): `doc/changes/` = 5 files (specs/plans/test-plans), `doc/guides/` = 6 files, `doc/templates/` = 2 files; **0** in `doc/decisions/`, `doc/spec/`, `doc/overview/`, `doc/inception/`, `doc/meetings/`.
- **The incident.** A gate-approved architecture doc shipped a mermaid block that does not render. It passed authoring, the inception gate, PR review, and CI — because nothing looks at doc renderability.
- **Doc-distribution scope (relevant boundary).** The GH-67 drift guard's DM-2 scan set is `doc/guides/*.md`, `doc/templates/**`, and five standalone docs incl. `.ai/rules/README.md`. **Individual `.ai/rules/*.md` rule files are NOT scanned** (verified: `bash.md`, `installer.md`, `testing-strategy.md` carry no `ados_distribution` marker); only `.ai/rules/README.md` does (`redistributable`).

### 2.2 Pain Points / Gaps

| # | Gap | Impact |
|---|-----|--------|
| G1 | No automated check inspects `doc/**` renderability — mermaid blocks are unvalidated end-to-end | Broken diagrams ship undetected |
| G2 | Doc-only changes have **no** guardrails (source changes have CI; doc changes have none) | Asymmetric quality; the bug recurs on every doc-authoring turn |
| G3 | Agents cannot "see" a broken diagram — they author text, and only a human rendering the page notices the break | Authoring-time feedback loop is absent; defects escape to review/production |
| G4 | No rule steers agents toward a render-gate self-check | Even a "valid"-looking diagram (syntactically) can fail to render and pass undetected |

## 3. PROBLEM STATEMENT

Because no automated check inspects documentation renderability and agents cannot visually detect a broken diagram, an authoring agent can emit a mermaid block that fails to render on GitHub and have it pass every existing gate (authoring, inception, PR review, CI) — resulting in unrenderable diagrams shipping into architecture/decision/process docs, where a human only discovers the break by manually rendering the page, and the same defect recurs on every subsequent doc-authoring turn unless a guard exists.

## 4. GOALS

- **G-1**: Give authoring agents instant, automated feedback when a mermaid block fails to parse/render (authoring-time loop).
- **G-2**: Make doc-only changes have an automated guardrail where today they have none (PR-time gate).
- **G-3**: Give agents a render-gate self-check so a broken diagram is caught before marking a doc DoR/DoD-passed.
- **G-4**: Deliver the gate as a benign, isolated, doc-path-scoped CI job that does not widen the existing `ci.yml` blast radius.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| `doc/**` paths with an automated renderability guard | 1 (today: 0) |
| Validator verdict determinism on a fixed repo state | 100% reproducible |
| Validator failure-message completeness (file + block index + first error) | 3/3 on every failure |
| Diagrams rule present (all Mermaid families allowed + render-gate self-check) | Yes (in `.ai/rules/diagrams.md`) |
| Doc-authoring agent prompts carrying the rule + self-check | 3/3 chosen agents (§5.1 F-4) |
| New runtime dependencies added to the existing `ci.yml` | 0 (dedicated workflow; `ci.yml` unchanged) |

### 4.2 Non-Goals

- **NG-1**: Markdownlint config + job — explicitly **non-goal** for this change (ticket lists it optional with no AC). Possible follow-up only.
- **NG-2**: Re-rendering diagrams to image assets (PNG/SVG committed to the repo).
- **NG-3**: Re-authoring any project's existing broken blocks (the validator must pass the current repo as the green baseline; it does not rewrite history).
- **NG-4**: Redistributing the validator or `.ai/rules/diagrams.md` to adopting projects (repo-internal automation + a non-distributed rule file; redistribution is a separate decision).
- **NG-5**: Validating non-mermaid fenced blocks, prose markdown linting, or link checking.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | **Mermaid render validator** — a script that extracts every ` ```mermaid ` block from `.md` across the doc scan roots and renders each headless via `mmdc`, failing non-zero on any parse/render failure with a precise message. | The core detection primitive; render-only per the original ticket intent (DEC-8). |
| F-2 | **CI gate (dedicated, doc-path-scoped)** — a new workflow `docs (mermaid validate)` that installs `mmdc` and runs the validator, failing the PR on a broken block. | The forcing function that makes a broken diagram unmergeable; isolated from `ci.yml`. |
| F-3 | **Diagrams rule** — `.ai/rules/diagrams.md` stating that all Mermaid families are allowed (including C4) and are validated by the render gate; indexed in `.ai/rules/README.md`. | Closes G4: gives agents a render-gate self-check so a broken diagram is caught before marking a doc DoR/DoD-passed. |
| F-4 | **Authoring self-check** — a concise (1–2 line) reference to the rule + the self-check added to the doc-authoring agent prompts that emit mermaid blocks; `.ados-claude/` regenerated. | Closes G3: agents get an authoring-time nudge and a cheap local check before marking a doc DoR/DoD-passed. |

### 5.1 Capability Details

**F-1 — Validator.** Scan roots are the union of `doc/`, `decisions/`, `changes/`, `inception/`, `.ai/` (the ticket's named roots). In this repo `decisions/`, `changes/`, `inception/` live under `doc/`, so `doc/**` already subsumes them; the explicit roots are named for robustness and to mirror the CI `paths:` filter. The script extracts every ` ```mermaid ` fenced block from in-scope `.md` files and renders each headless via `mmdc`, exiting non-zero on any parse/render failure. Every failure reports **file path + block index + first error**. Local use is opt-in/heavier, gated behind `--if-present` (a no-op skip when `mmdc` is absent, so a missing local tool never hard-fails an authoring run); CI always installs `mmdc` and treats the render as mandatory. The script and its test follow `.ai/rules/bash.md` (strict mode + traps; leveled logging with a context tag; `MMDC_CMD` dependency-injection via env for mockability; mockable wrappers; embedded test framework; testable main guard; documented exit codes; `--if-present` / `--help` / `--version`). The test lives at `scripts/.tests/test-validate-mermaid.sh` and is auto-discovered by `scripts/test-all.sh`. No license header is hand-added (headers are managed solely by `scripts/add-header-location.sh` on configured paths; `scripts/` is not a header-configured path).

**F-2 — CI gate.** A dedicated workflow file `.github/workflows/docs-mermaid-validate.yml` triggered `on: pull_request` with a `paths:` filter on `[doc/**, decisions/**, changes/**, inception/**, .ai/rules/**, scripts/validate-mermaid.sh, .github/workflows/**]`. Job name `docs (mermaid validate)`; `runs-on: ubuntu-latest`; `permissions: contents: read`; **no `pull_request_target`** (no secret-surface widening); **no deploy**. The job installs `@mermaid-js/mermaid-cli` (`mmdc`) and runs the validator. The existing `ci.yml` (no `paths:` filter) is **unchanged** — the gate is a separate workflow, not a paths-filtered job inside `ci.yml` (DEC-1).

**F-3 — Diagrams rule.** `.ai/rules/diagrams.md` (kebab-case `.md`, per `.ai/rules/README.md` naming convention) carries: a statement that all Mermaid families are allowed (including C4 — `C4Context`/`C4Container`/`C4Component`); common families listed for convenience (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`); and a self-check to run `scripts/validate-mermaid.sh` (renders each block via `mmdc`) before marking a doc DoR/DoD-passed. A `diagrams.md` row is added to the `.ai/rules/README.md` rule index. **Marker rule:** individual `.ai/rules/*.md` files are **not** in the GH-67 DM-2 scan set, so `.ai/rules/diagrams.md` requires **no** `ados_distribution` marker (only `.ai/rules/README.md` is marker-scanned; verified). The new CI workflow `.yml` is not a doc and carries no marker.

**F-4 — Authoring self-check (agent set, evidence-based).** The chosen set is **`spec-writer`, `doc-syncer`, `bootstrapper`** — the three doc-authoring agents whose outputs are the real mermaid surfaces today (audit: `doc/changes/**` = 5 files, `doc/guides/**` = 6 files, `doc/templates/**` = 2 files). Each prompt gains a 1–2 line reference to `.ai/rules/diagrams.md` plus the self-check (run the validator, which renders each mermaid block via `mmdc`) before marking a doc DoR/DoD-passed. Excluded candidates with justification:

| Agent | In/Out | Justification (grounded in audit) |
|-------|:------:|-----------------------------------|
| `spec-writer` | **In** | Authors change specs (`doc/changes/**`) — the #1 mermaid surface (5 files); the spec template's flows section explicitly invites mermaid. |
| `doc-syncer` | **In** | Reconciles/creates guides + feature specs (`doc/guides/**` = 6 files); the recurring diagram surface where new mermaid enters current-truth docs. |
| `bootstrapper` | **In** | Generates guides/templates during inception AND authors `architecture-overview` (C4 L1/L2 per GH-90) — a primary mermaid surface where the render-gate self-check must land. |
| `decision-advisor` | Out | Decision records (`doc/decisions/**`) contain **0** mermaid today; predominantly prose + tables. The CI gate still scans `decisions/**` regardless, so any block is caught. |
| `editor` | Out | Rewrites/translates existing content and preserves code blocks verbatim; it does not author new mermaid blocks. |
| `meeting-organizer` | Out | Meeting notes (`doc/meetings/**`) contain **0** mermaid; agenda/summary prose, mermaid incidental. |

> Note: change-artifact agents `plan-writer` and `test-plan-writer` also emit mermaid in `doc/changes/**`, but they are outside the PM-designated candidate set; the CI gate covers `changes/**` regardless, so no defect escapes. Prompt edits to the chosen 3 require `.ados-claude/` regeneration via `scripts/build-claude-plugin.sh` (CI verifies freshness) — the plan must include regen + commit (DEC-2 / RSK-5).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Author emits a broken mermaid block (the failure we now prevent, locally)
  Agent authors a ```mermaid block in doc/**
  → before marking DoR/DoD-passed, runs validate-mermaid.sh
  → mmdc reports a parse/render error (file + block index + first error)
  → agent fixes the block; re-validates; then marks passed

Flow 2 — Broken block reaches CI (the hard gate)
  PR touches a doc path; docs-mermaid-validate.yml triggers
  → job installs mmdc, runs validate-mermaid.sh
  → non-zero exit ⇒ PR check fails, blocks merge (with ::error:: annotation)

Flow 3 — C4 (allowed; rendered by the gate)
  Agent authors a C4Context diagram
  → .ai/rules/diagrams.md: all Mermaid families are allowed (including C4)
  → validator renders it via mmdc; GitHub renders it

Flow 4 — Doc-only PR, no doc paths touched
  PR touches only source → paths filter does not match → docs-mermaid-validate.yml does not run (no cost)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `scripts/validate-mermaid.sh` — mermaid render validator (F-1), `--if-present` optional locally, follows `.ai/rules/bash.md`.
- `scripts/.tests/test-validate-mermaid.sh` — test (fails on a broken block, passes a valid one); auto-discovered by `scripts/test-all.sh`.
- `.github/workflows/docs-mermaid-validate.yml` — dedicated CI workflow, job `docs (mermaid validate)`, doc-path-scoped, benign (F-2). `ci.yml` unchanged.
- `.ai/rules/diagrams.md` — all Mermaid families allowed (incl. C4) + render-gate self-check (F-3).
- `.ai/rules/README.md` — add a `diagrams.md` row to the rule index (F-3).
- `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md` — concise rule reference + self-check (F-4); regenerate `.ados-claude/` via `scripts/build-claude-plugin.sh`.

### 7.2 Out of Scope

- [OUT] Markdownlint config + CI job (NG-1).
- [OUT] Re-rendering diagrams to committed image assets (NG-2).
- [OUT] Re-authoring existing broken blocks (NG-3).
- [OUT] Redistributing the validator or the diagrams rule to adopting projects (NG-4).
- [OUT] Non-mermaid fenced-block validation, prose linting, link checking (NG-5).
- [OUT] Editing `ci.yml` (DEC-1 — dedicated workflow instead).

### 7.3 Deferred / Maybe-Later

- Markdownlint config + job (possible follow-up; out of scope here per NG-1).
- Redistributing `.ai/rules/diagrams.md` + the validator to adopters (separate distribution decision; the rule file is not in the GH-67 DM-2 install set today).
- Extending the self-check to `plan-writer` / `test-plan-writer` (outside the PM-designated candidate set; CI covers `changes/**` regardless).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface.

### 8.2 Events / Messages

N/A — no event/message surface.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Validator exit-code contract | Documented exit codes per `.ai/rules/bash.md`: success (0), usage error (2), missing-`mmdc`-when-required (3), render failure (4). A block passes iff its `mmdc` headless render exits 0 (DEC-8 — render-only); any non-zero render ⇒ failure. `mmdc` is invoked via the injectable `MMDC_CMD`. |
| DM-2 | Scan-root set | The union `{doc, decisions, changes, inception, .ai}` over `.md` files, **excluding git-ignored paths (notably `.ai/local/` ephemeral scratch)**. In this repo the `decisions/changes/inception` trees live under `doc/`, so `doc/**` subsumes them; the explicit roots mirror the CI `paths:` filter for robustness. The script skips any `.md` under `.ai/local/` so local scratch never trips a run. |
| DM-3 | Rule content model | `.ai/rules/diagrams.md` carries: a statement that all Mermaid families are allowed (including `C4Context`/`C4Container`/`C4Component`); common families listed for convenience (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`); and a render-gate self-check (run `scripts/validate-mermaid.sh` before marking a doc DoR/DoD-passed). |

### 8.4 External Integrations

- **`@mermaid-js/mermaid-cli` (`mmdc`)** — npm package, installed in the CI job at setup; pulls `puppeteer` + a Chromium binary (transitive). No network use at validation time beyond the install; no doc content leaves the runner.

### 8.5 Backward Compatibility

- **Additive only.** A new script, a new workflow, a new rule, a README index row, and 1–2-line additions to three agent prompts. No existing doc content is modified; the validator must pass the current repo as the green baseline before the gate is enabled.
- **`ci.yml` unchanged** (DEC-1); the new gate is a separate workflow, so existing CI behavior is untouched.
- **`.ados-claude/` regenerated** for the three edited agent prompts; CI's `verify-claude-build` job enforces freshness.
- **Doc-distribution guard unaffected** — `.ai/rules/diagrams.md` is not in DM-2 (no marker required); only the `.ai/rules/README.md` index row changes (README already carries its marker).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Validator determinism — fixed repo state ⇒ fixed verdict, independent of run order | 100% reproducible (no time/randomness dependence) |
| NFR-2 | CI runtime — full repo doc-set validation on `ubuntu-latest` | < 120s wall-clock (dominated by Chromium cold-start; one render per block). **CI-only observation** — not assertable in the local fast suite; observed on real PR runs (the workflow includes a Chromium/puppeteer cache step) |
| NFR-3 | Local opt-in safety — `--if-present` never hard-fails a local authoring run on a missing tool | Local invocation without `mmdc` exits 0 with a skip notice; CI (which installs `mmdc`) is mandatory |
| NFR-4 | Failure-message specificity | Every failure message contains all of: file path, block index, first error line (3/3) |
| NFR-5 | Render contract | A block passes iff its `mmdc` headless render exits 0 (render-only; DEC-8) |
| NFR-6 | `bash.md` conformance — script + test | ShellCheck-clean, `shfmt -i 2 -ci -bn`-formatted; strict mode + traps; context-tagged logging; `MMDC_CMD` env injection; embedded test framework; testable main guard; documented exit codes; `--if-present`/`--help`/`--version` |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- On failure, the validator emits a clear, machine- and human-readable message (file + block index + first error) to CI logs, with GitHub `::error::` annotations where supported (NFR-4).
- No runtime metrics/logs/alerts beyond CI step output — this is a repo-internal build gate.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | `mmdc`/puppeteer/Chromium is heavy/flaky — CI runtime + cold-start flakiness | M | M | Dedicated, doc-path-scoped job isolated from `ci.yml` (DEC-1); cache the puppeteer/Chromium install; NFR-2 budget | M |
| RSK-2 | **Render flakiness/divergence** — `mmdc`'s bundled Mermaid version drifts from GitHub's; a block renders in one but not the other | M | L-M | Pin `mmdc` version deliberately; GitHub renders all Mermaid families including C4 (DEC-8) so no keyword guard is applied | L-M |
| RSK-3 | False positives — `mmdc` fails a block GitHub would render (newer syntax) | L-M | M | Pin/upgrade `mmdc` deliberately | L |
| RSK-4 | `--if-present` local ambiguity — agents skip local validation (no `mmdc`), then a broken block ships | M | M | CI is the hard gate (always installs `mmdc`); the agent self-check references the render gate (F-4) | L-M |
| RSK-5 | `.ados-claude/` regen drift — editing 3 agent prompts without regenerating → stale plugin blocks merge | M | L | Plan includes regen + commit; `ci.yml` `verify-claude-build` enforces freshness | L |
| RSK-6 | Marker/index confusion — someone adds `ados_distribution` to `diagrams.md` unnecessarily, or omits the README index row | L | L | Spec states the rule (F-3 / §2.1): individual rule files are not DM-2-scanned; only the README index row is required | L |

## 12. ASSUMPTIONS

- `mmdc` is an acceptable proxy oracle for GitHub renderability; GitHub renders all Mermaid families including C4 (DEC-8).
- The current repo is the green baseline — the validator passes every existing mermaid block (audit §2.1).
- The PM-designated candidate agent set is authoritative for AC#4; `plan-writer`/`test-plan-writer` are intentionally excluded (CI covers `changes/**`).
- `decisions/`, `changes/`, `inception/` live under `doc/` in this repo (verified), so `doc/**` subsumes them; the explicit scan roots mirror the CI `paths:` filter.
- `scripts/test-all.sh` auto-discovers `scripts/.tests/test-validate-mermaid.sh` by naming convention (no aggregator edit needed).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | `@mermaid-js/mermaid-cli` (`mmdc`) | External npm package; pulls puppeteer + Chromium (transitive). Pinned version managed to bound render divergence (RSK-2) |
| Depends on | `.ai/rules/bash.md` | Script + test standard (NFR-6) |
| Depends on | `scripts/test-all.sh`, `scripts/build-claude-plugin.sh` | Test auto-discovery; `.ados-claude/` regen for agent edits |
| Depends on | `scripts/.tests/test-doc-distribution.sh` | Confirms `.ai/rules/diagrams.md` is out of DM-2 scope (no marker needed) |
| Related | GH-67 (doc-distribution guard), Epic #107 (drift detection & gate enforcement) | Same drift/gate family; this change closes the doc-renderability gap GH-67 does not cover |
| Blocks | None | New feature area; spec coverage authored at phase 7 (PM decision #5) |

> **Spec-coverage status:** this is a **new feature area** (`doc-mermaid-validation`); no `doc/spec/features/feature-doc-mermaid-validation.md` exists today (verified — `doc/spec/**` has 0 mermaid and this capability is net-new). Per PM decision #5, `@doc-syncer` authors that feature spec in-change at **phase 7** (delivery mode: autonomous). The spec-writer does not author it now.

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | ~~Should `validate-mermaid.sh` also keyword-guard C4?~~ **RESOLVED → DEC-7 → REVERSED by DEC-8** | DEC-7 originally enforced a C4 keyword guard on the premise that GitHub did not render C4. PR #123 review verified GitHub now renders Mermaid C4, so the premise is obsolete. **DEC-8** reverses DEC-7: the validator is RENDER-ONLY; C4 is allowed without restriction. | **RESOLVED (DEC-8):** render-only per the original ticket; the keyword guard is removed. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Dedicated workflow `.github/workflows/docs-mermaid-validate.yml` (doc-path-scoped), not a paths-filtered job inside `ci.yml` | `ci.yml` has no `paths:` filter today and stays unchanged; isolation keeps the Chromium-bearing job off every PR (PM decision #2) | 2026-07-03 |
| DEC-2 | Agent-prompt edits regenerate `.ados-claude/` via `scripts/build-claude-plugin.sh` and commit source + generated together | CI verifies freshness; AGENTS.md generated-plugin rule | 2026-07-03 |
| DEC-3 | AC#5 "CEO-gated PR" is a **review/release flag** surfaced in the PR description (change touches `scripts/` + `.github/`), **not** an automated/runtime gate | PM decision #3; represented in §18 Rollout, not as a runtime AC | 2026-07-03 |
| DEC-4 | AC#4 doc-authoring agent set = `{spec-writer, doc-syncer, bootstrapper}` | Evidence-based (audit §2.1 / §5.1 F-4): the three real mermaid authoring surfaces; minimizes `.ados-claude/` regen surface (PM decision #4) | 2026-07-03 |
| DEC-5 | `.ai/rules/diagrams.md` carries **no** `ados_distribution` marker | Individual `.ai/rules/*.md` are not in the GH-67 DM-2 scan set; only `.ai/rules/README.md` is marker-scanned (verified) | 2026-07-03 |
| DEC-6 | Markdownlint config + job is a **non-goal** for this change | PM decision #1; ticket lists it optional with no AC; noted as a possible follow-up (NG-1) | 2026-07-03 |
| DEC-7 | **SUPERSEDED by DEC-8.** Originally: `validate-mermaid.sh` enforces **both** renderability (mmdc) **and** a non-render-safe keyword guard (C4 denylist). `.ai/rules/diagrams.md` was the **canonical** keyword source. (Resolves OQ-1.) | Originally: the motivating incident was a GitHub-render divergence (`mmdc` renders C4 that GitHub does not). **Reversed (DEC-8):** GitHub now renders Mermaid C4 (verified during PR #123 review), so this premise is obsolete. | 2026-07-03 |
| DEC-8 | **C4 is ALLOWED (no restrictions).** The validator is RENDER-ONLY: it renders each mermaid block via `mmdc` and fails on parse/render error (per the original ticket). No keyword guard. GitHub renders Mermaid C4 (verified by the owner during PR #123 review); DEC-7's premise ("mmdc renders C4 but GitHub does not") is obsolete. `.ai/rules/diagrams.md` states all Mermaid families are allowed (including C4). | Reverses DEC-7. The validator returns to the ticket's original render-only intent. The keyword guard, `RENDER_SAFE_DENYLIST`, exit code 5, and the C4-avoidance rule are removed; exit codes are now 0/2/3/4. | 2026-07-04 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `scripts/validate-mermaid.sh` | New (F-1) |
| `scripts/.tests/test-validate-mermaid.sh` | New (F-1; auto-discovered by `scripts/test-all.sh`) |
| `.github/workflows/docs-mermaid-validate.yml` | New (F-2) |
| `.github/workflows/ci.yml` | Unchanged (DEC-1) |
| `.ai/rules/diagrams.md` | New (F-3; all families allowed incl. C4; no marker — DEC-5) |
| `.ai/rules/README.md` | Updated — add `diagrams.md` index row (F-3) |
| `.opencode/agent/spec-writer.md`, `doc-syncer.md`, `bootstrapper.md` | Updated — rule reference + self-check (F-4) |
| `.ados-claude/agent/*` (corresponding) | Regenerated via `scripts/build-claude-plugin.sh` (DEC-2) |

## 17. ACCEPTANCE CRITERIA

> Grouped by area; Given/When/Then; each links to ≥1 F-/DM-/NFR-. Maps 1:1 to the ticket's 5 ACs. **AC#5 is a review/release flag, not a runtime AC (DEC-3) — see §18.**

### A. Validator + test (ticket AC#1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `scripts/validate-mermaid.sh` exists and `mmdc` is available, **when** run against a fixture containing a broken ` ```mermaid ` block, **then** it exits non-zero with a message naming the file, the block index, and the first error. | F-1, DM-1, NFR-4 |
| AC-F1-2 | **Given** the validator, **when** run against a fixture containing a valid block, **then** it exits 0. | F-1, NFR-5 |
| AC-F1-3 | **Given** `scripts/.tests/test-validate-mermaid.sh`, **when** run (and via `scripts/test-all.sh`), **then** it exercises the broken-block failure and the valid-block pass, and passes; the script follows `.ai/rules/bash.md` (ShellCheck-clean, documented exit codes, `MMDC_CMD` injection, `--if-present`/`--help`/`--version`). | F-1, NFR-6 |

### B. CI gate (ticket AC#2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** `.github/workflows/docs-mermaid-validate.yml`, **when** a PR touches a path under the `paths:` filter, **then** the job `docs (mermaid validate)` runs on `ubuntu-latest` with `permissions: contents: read`, no `pull_request_target`, no deploy, installs `mmdc`, and runs the validator. | F-2 |
| AC-F2-2 | **Given** a PR introducing a broken ` ```mermaid ` block in a scanned path, **when** the job runs, **then** it fails the PR (non-zero step exit). The existing `ci.yml` is unchanged. | F-2, DEC-1 |

### C. Diagrams rule (ticket AC#3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** `.ai/rules/diagrams.md`, **when** read, **then** it states that all Mermaid families are allowed (including C4) and lists common families (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`). | F-3, DM-3 |
| AC-F3-2 | **Given** the rule, **when** read, **then** it allows all families (incl. C4) and references the render gate (run `scripts/validate-mermaid.sh` before marking a doc DoR/DoD-passed). | F-3, DM-3 |
| AC-F3-3 | **Given** `.ai/rules/README.md`, **when** read, **then** it contains a `diagrams.md` row in the rule index; `.ai/rules/diagrams.md` carries **no** `ados_distribution` marker (it is outside DM-2). | F-3, DEC-5 |

### D. Authoring self-check (ticket AC#4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** the chosen doc-authoring agents (`spec-writer`, `doc-syncer`, `bootstrapper`), **when** their prompts are read, **then** each carries a concise (1–2 line) reference to `.ai/rules/diagrams.md` and the self-check (run `scripts/validate-mermaid.sh`, which renders each mermaid block via `mmdc`) before marking a doc DoR/DoD-passed; and `.ados-claude/` is regenerated and committed fresh. | F-4, DEC-2, DEC-4 |

### E. CEO-gated PR (ticket AC#5) — review flag, not a runtime gate

> Per DEC-3 / PM decision #3: this change touches `scripts/` + `.github/`, so the PR description surfaces a **CEO-gate review flag** for the human reviewer. It is **not** an automated gate and is intentionally **not** a runtime AC. Captured in §18 ROLLOUT.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Deliver `scripts/validate-mermaid.sh` + `scripts/.tests/test-validate-mermaid.sh`; verify the validator passes the current repo as the **green baseline** before enabling the gate (NFR-1).
2. Deliver `.ai/rules/diagrams.md` + the `.ai/rules/README.md` index row.
3. Deliver `.github/workflows/docs-mermaid-validate.yml` (dedicated, doc-path-scoped); confirm it triggers only on doc-path PRs and is green on the baseline.
4. Edit the three agent prompts (`spec-writer`, `doc-syncer`, `bootstrapper`); regenerate `.ados-claude/` via `scripts/build-claude-plugin.sh`; commit source + generated together (DEC-2).
5. **CEO-gated PR (AC#5 / DEC-3):** because the change touches `scripts/` + `.github/`, the PR description surfaces a review flag for the human reviewer. Not an automated gate.
6. **Phase 7 (`@doc-syncer`):** author `doc/spec/features/feature-doc-mermaid-validation.md` (new feature area; PM decision #5).
7. Merge strategy: single PR; the mermaid gate and doc-distribution guard must both pass before merge.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data. The validator treats the current repo as the green baseline (no existing block is re-authored; NG-3).

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal data is processed. `mmdc` renders repo doc content headlessly on the runner; no doc content leaves the runner beyond the `mmdc`/Chromium install at job setup.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Benign workflow:** `permissions: contents: read`, **no `pull_request_target`** (no secret-surface widening), **no deploy**. (F-2 / DEC-1.)
- `mmdc`/Chromium execute in the CI sandbox; no network at validation time beyond the package install.
- Authored mermaid blocks are **untrusted input** to `mmdc`: the validator renders only (no instruction-following, no embedded-command execution) — consistent with the repo's untrusted-content discipline.
- No new secrets, tokens, or credentials involved.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing:** adding a mermaid block now has an automated guardrail; doc-only changes gain a gate where they had none. The motivating bug class is closed at both authoring time (F-4) and PR time (F-2).
- **Cost:** one CI job on doc-path PRs (Chromium install + per-block render; NFR-2 budget). Source-only PRs incur no cost (`paths:` filter).
- **Drift management:** pin `mmdc` version; render divergence vs GitHub is the key ongoing risk (RSK-2). `.ai/rules/diagrams.md` is the canonical diagrams rule (all families allowed, incl. C4 — DEC-8).
- **Consistency contract:** the script's scan-root set (DM-2) and the CI `paths:` filter must stay aligned; future doc-tree layout changes require updating both.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| `mmdc` | `@mermaid-js/mermaid-cli` — headless Mermaid renderer (CLI); pulls puppeteer + Chromium. |
| C4 | Mermaid C4 diagrams (`C4Context`/`C4Container`/`C4Component`) — GitHub renders them, so they are allowed without restriction (DEC-8). |
| Render divergence | A block whose render result differs between `mmdc` and GitHub. |
| `--if-present` | Validator mode that skips (exit 0) when `mmdc` is absent, so local authoring never hard-fails on a missing tool; CI is mandatory. |
| DM-2 | The GH-67 doc-distribution scan set; individual `.ai/rules/*.md` are **not** in it (only `.ai/rules/README.md` is). |
| Green baseline | The current repo state, on which the validator must pass before the gate is enabled. |

## 24. APPENDICES

- **Appendix A — Mermaid presence audit (current repo).** ```mermaid``` fenced blocks: `doc/changes/` = 5 files (specs/plans/test-plans), `doc/guides/` = 6 files, `doc/templates/` = 2 files; `doc/decisions/`, `doc/spec/`, `doc/overview/`, `doc/inception/`, `doc/meetings/` = 0 each. This grounds the F-4 agent set and confirms the green baseline.
- **Appendix B — Source inputs.** GitHub issue GH-110 (epic #107 "Drift detection & gate enforcement"); PM binding decisions #1–#5; `.ai/rules/bash.md` (script/test standard); `.ai/rules/README.md` (rule index + naming + marker scope); `.github/workflows/ci.yml` (no `paths:` filter, unchanged); `scripts/.tests/test-doc-distribution.sh` (DM-2 scan set); `scripts/test-all.sh` (auto-discovery); the candidate agent prompts (`.opencode/agent/*`); the live mermaid-presence audit.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | `@spec-writer` | Initial specification for GH-110 |
| 1.1 | 2026-07-04 | `@coder` (PR #123 review) | Review-driven reversal: GitHub renders Mermaid C4 (owner-verified), so DEC-7 (C4 keyword guard / dual check) is **SUPERSEDED by DEC-8** (C4 allowed; validator is RENDER-ONLY). Removed AC-F1-4; reworded AC-F3-2 (rule allows all families incl. C4 + render gate). Updated F-1 (render validator), DM-1 (exit codes 0/2/3/4), DM-3 (no denylist), NFR-5 (render contract), §1, §5, §6, §17. AC count now 9 (was 10). |

---

## AUTHORING GUIDELINES

- **Sources:** GitHub issue GH-110 (epic #107); PM binding decisions #1–#5; `doc/templates/change-spec-template.md` (structure); `.ai/rules/bash.md` (script/test standard); `.ai/rules/README.md` (rule index, naming, marker scope); `.github/workflows/ci.yml` (current CI, unchanged); `scripts/.tests/test-doc-distribution.sh` (DM-2 scan set, confirming individual rule files are out of scope); `scripts/test-all.sh` (test auto-discovery); the candidate agent prompts (`.opencode/agent/*`); sibling specs `chg-GH-67-spec.md` and `chg-GH-90-spec.md` (tone/frontmatter/AC conventions).
- **Approach:** capabilities map 1:1 to the four deliverables; the AC#4 agent set is **evidence-based** (a live mermaid-presence audit), not asserted — chosen 3 are the real authoring surfaces, excluded 3 are justified per-directory. OQ-1 (whether the script keyword-guards C4) was resolved by DEC-7 then **reversed by DEC-8** after PR #123 review verified GitHub renders Mermaid C4.
- **Constraints honored:** no implementation steps or file-level code paths as instructions (component names appear only as affected components / scope, consistent with sibling specs); no commit (PM/committer handles commits); PM decisions recorded as DEC-1–DEC-6 (not re-litigated); no license headers hand-added; spec-coverage gap noted for phase 7 (not authored here).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-110)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths as instructions; no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
