---
change:
  ref: GH-37
  type: feat
  status: Proposed
  slug: ai-tuned-quality-gates-script
  title: "AI-tuned quality-gates runner script + operator guide (close the /check dangling dependency)"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["quality-gates", "scripts", "docs", "runner", "phase-9"]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["scripts/test-all.sh", "scripts/.tests/test-doc-distribution.sh", "scripts/build-claude-plugin.sh", "AGENTS.md", ".ai/rules/bash.md", "feature-quality-gates-and-pr.md", ".opencode/command/check.md"]
    external: []
links:
  related_changes: ["GH-78", "GH-67"]
  closes: ["GH-37"]
  deferred_to: ["companion-ticket (hard-NFR enforcement + config-vs-code gate)", "epic #49 (ados check CLI)", "#93 (test-execution evidence gate)"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Close ADOS's documented, dangling dependency by creating the missing `scripts/quality-gates.sh` — an AI-tuned runner/orchestrator that the `/check` → `@runner` resolution path (NFR-1 of `feature-quality-gates-and-pr.md`) already mandates — and document how to run, configure, and extend it, so the `quality_gates` lifecycle phase (9) becomes concretely runnable through the single canonical command instead of failing at resolution.

## 1. SUMMARY

This change delivers the scaffolding for an **AI-tuned quality-gates runner** plus its operator guide. Today every `/check` invocation fails at resolution: the system spec (`feature-quality-gates-and-pr.md`, NFR-1 + Dependencies line 109), the `/check` and `/check-fix` command prompts, and `doc/guides/onboarding-existing-project.md` all reference `./scripts/quality-gates.sh` — but **that file does not exist**, and `AGENTS.md` declares no explicit runner instruction. The repo's real gates (test aggregation, doc-distribution drift guard, Claude-plugin freshness, `git diff --check`) are run ad hoc, not through the single resolution path the spec mandates. This change:

- Adds `scripts/quality-gates.sh` — a stdlib-bash orchestrator that discovers the gate set (from `AGENTS.md` preferred, else a documented built-in default set), runs each gate, captures per-gate exit code + duration + a short failure excerpt, emits an AI-actionable structured summary with log pointers, and exits non-zero if any gate fails.
- Adds `scripts/.tests/test-quality-gates.sh` — a bash test suite proving the runner's contract (resolution, per-gate reporting, exit codes, AI-actionable output, arg handling), auto-picked-up by `scripts/test-all.sh` and the CI `bash-tests` job.
- Adds `doc/guides/quality-gates.md` — "document how to use": running gates, declaring gates in `AGENTS.md`, adding a project-specific gate, the AI-tuned output contract, exit-code semantics, and log locations (`ados_distribution: redistributable`).
- Reconciles `feature-quality-gates-and-pr.md` surgically so its dangling reference becomes a real component, and wires `AGENTS.md` with the minimal honest declaration that makes `/check` → `@runner` → `scripts/quality-gates.sh` deterministic.

The two substantial owner-comment policies (hard-NFR enforcement; config-vs-code early gate), the `ados check` CLI (epic #49), and the test-execution evidence gate (#93) are explicitly deferred to separate tickets (Non-Goals §7.2 / Deferred §7.3).

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The 11-phase lifecycle is gated** (`AGENTS.md`, `doc/guides/change-lifecycle.md`). `quality_gates` = phase 9, immediately after `review_fix` (8) and before `dod_check` (10). Phase 9 is run by `/check` (run-only) or `/check-fix` (run + fix).
- **`/check` resolves the gates command via a documented contract** (`.opencode/command/check.md` §`<resolution>`): (1) read `AGENTS.md` for an explicit quality-gates runner instruction; (2) default fallback `./scripts/quality-gates.sh`; (3) pass through user args `[fast|slow|all|<gate>...]`; (4) always run from repo root. Execution is delegated to `@runner`; logs land under `tmp/run-logs-runner/<YYYY-MM-DD>/`.
- **`AGENTS.md` declares NO explicit quality-gates runner instruction** (verified). The `/check` resolution contract therefore always falls back to step 2.
- **`scripts/quality-gates.sh` does NOT exist** (verified — not present under `scripts/`). The fallback target is missing, so `/check` cannot resolve a runnable command; the `quality_gates` phase is effectively unrunnable through the canonical command today.
- **The system spec already treats the script as real.** `feature-quality-gates-and-pr.md` NFR-1: "`/check` resolves the gates command from `AGENTS.md` (default `./scripts/quality-gates.sh`) — Deterministic resolution"; Dependencies line 109: "Depends on: a repo quality-gates script (`./scripts/quality-gates.sh` or the path named in `AGENTS.md`)." Its Testing Approach table (§Quality Assurance) is **Manual**-only.
- **The repo's real gates exist but are run ad hoc**, not through one resolution path: `scripts/test-all.sh` (aggregates every `test-*.sh` under `scripts/.tests/` and `tools/.tests/`); `scripts/.tests/test-doc-distribution.sh` (GH-67 marker + install-set drift guard); `scripts/build-claude-plugin.sh` (idempotent `.opencode/` → `.ados-claude/` generation; CI verifies freshness by checking `.ados-claude/` is clean after a rebuild); `git diff --check` (whitespace/conflict-marker hygiene).
- **CI runs four relevant jobs** (`.github/workflows/ci.yml`): `verify-claude-build` (plugin freshness), `doc-distribution-guard`, `bash-tests` (auto-discovers `*/.tests/test-*.sh` via `find … -not -path './tmp/*' … -print -exec bash {} \;` with `set -e`; installs `jq`), and `shellcheck` (gating on `error` severity, `ignore_paths: node_modules .git .ados-claude tmp`).
- **Bash conventions are codified** in `.ai/rules/bash.md`: Bash 4.0+, `set -Eeuo pipefail` + `errtrace` + `inherit_errexit`, `IFS=$'\n\t'`, ERR/EXIT/INT/TERM traps, a stable `LOG_TAG="(script-name)"`, dependency-injection-via-env, a testable main guard (`if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi`), an embedded test framework skeleton (§11), and an exit-code contract (§10.5).
- **Header convention for `scripts/`.** `scripts/add-header-location.sh` `DEFAULT_PATHS` (line 46) = `.opencode/agent .opencode/command doc/guides doc/documentation-handbook.md tools` — `scripts/` is **not** a default header path. Existing `scripts/*.sh` (e.g., `test-all.sh`, `.tests/test-doc-distribution.sh`) therefore carry **descriptive comment headers** (purpose/deps/usage/env/exit-codes per bash.md §1, §14), **not** the copyright license block. `AGENTS.md` is explicit: AI agents must never hand-add license headers.
- **The `ados_distribution` marker system (GH-67) is in force** for the closed DM-2 doc set (`doc/guides`, `doc/templates/**`, and 5 standalone docs). Any **new** guide under `doc/guides/` MUST declare `ados_distribution: {redistributable|internal|project-generated}` or the drift guard fails (mode: missing-marker).

### 2.2 Pain Points / Gaps

- **A documented, dangling dependency.** The spec, both commands, and the onboarding guide all point at `scripts/quality-gates.sh`, which does not exist. `/check` is a no-op-at-best, hard-failure-at-worst today.
- **Phase 9 is unrunnable through the canonical path.** The lifecycle's `quality_gates` step cannot be exercised via `/check`/`/check-fix`; maintainers run gates manually and inconsistently.
- **No single source of gate truth.** The real gates are scattered across scripts and CI jobs with no orchestrator that (a) runs them in one deterministic pass, (b) reports per-gate pass/fail in an AI-actionable shape, and (c) returns a single honest exit code.
- **Output is not agent-tuned.** When gates are run ad hoc, `@runner`/`@fixer` get raw command output, not a structured per-gate summary (name, status, duration, failure excerpt, log pointer) that an agent can act on deterministically.
- **No redistributable operator guide** for how ADOS-managed projects declare, run, or extend quality gates.
- **Spec drift.** `feature-quality-gates-and-pr.md` asserts a runner that does not exist; its Testing Approach is "Manual" only.

## 3. PROBLEM STATEMENT

Because the system spec and the `/check`/`/check-fix` commands all resolve quality gates to a `scripts/quality-gates.sh` that does not exist (and `AGENTS.md` declares no runner instruction), the `quality_gates` phase (9) of the 11-phase lifecycle is effectively unrunnable through the canonical command — leaving the repo's real gates to be invoked ad hoc with no deterministic, AI-actionable per-gate reporting and no single honest exit code, contradicting the spec's own NFR-1 ("deterministic resolution").

## 4. GOALS

- **G-1**: Make the `/check` → `@runner` → `scripts/quality-gates.sh` resolution path work end-to-end — the spec's NFR-1 "deterministic resolution" becomes real, not aspirational.
- **G-2**: Deliver an **AI-tuned** runner: deterministic exit codes, per-gate structured pass/fail reporting, AI-actionable failure messages, and log pointers consistent with `@runner`'s `tmp/run-logs-runner/` conventions.
- **G-3**: Make the runner **extensible scaffolding** usable by other ADOS-managed projects: it discovers gates from `AGENTS.md` (preferred) with a sensible built-in default set, and projects add/override gates without editing the script's core.
- **G-4**: Provide a redistributable guide documenting how to author, configure, and run quality gates for a repo.
- **G-5**: Make the `quality_gates` lifecycle phase (9) concretely runnable.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| `/check` resolves and runs a real runner on a clean tree (exit 0, all gates passing) | 1 / 1 (end-to-end) |
| Real repo gates orchestrated (not reimplemented) | ≥ 4 (test-all, doc-distribution guard, plugin freshness, `git diff --check`) |
| Per-gate report fields emitted (name, status, duration, failure pointer+excerpt on fail) | 4 / 4 (100% of gates) |
| Exit-code determinism (0 iff all pass; non-zero iff ≥1 fails; no third state) | 100% |
| New test suite proving the contract (resolution/reporting/exit/output/args) | discovered by `scripts/test-all.sh` and CI `bash-tests` |
| New redistributable guide declaring `ados_distribution: redistributable` | 1 / 1; drift guard green |
| No-regression on plugin freshness, shellcheck (`error`), doc-distribution guard | all green |
| `.ados-claude/` regenerated iff `.opencode/` sources changed | 1:1 invariant |

### 4.2 Non-Goals

- **NG-1**: No reimplementation or parallel test framework — the runner **invokes** the existing gates (e.g., `scripts/test-all.sh`, the doc-distribution guard) as gates; it does not rediscover tests.
- **NG-2**: The two owner-comment policies are **deferred** to a proposed companion ticket: (a) hard-NFR enforcement (every hard NFR must have an automated assertion OR structural rule); (b) config-vs-code early gate (smoke config before the Definition of Ready). This change does not implement either.
- **NG-3**: No `ados check` / `ados quality-gates` CLI command (epic #49) — separate ticket.
- **NG-4**: No test-execution evidence gate (#93) — separate ticket.
- **NG-5**: No rewrite of the `/check` or `/check-fix` command/agent definitions beyond what makes resolution work (the commands already reference the script; their delegation is unchanged).
- **NG-6**: No full `fast`/`slow` gate taxonomy implementation unless trivially bounded — `all` (default) + named-gate selection is the honest minimum; the rest is documented as future (OQ-1).
- **NG-7**: No license headers hand-added by the AI; `scripts/` files follow the established descriptive-comment-header convention (bash.md §1/§14).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | **AI-tuned quality-gates runner** — `scripts/quality-gates.sh` orchestrates the repo's gates in one deterministic pass, capturing per-gate exit code + duration, and returns a single honest exit code (0 iff all pass; non-zero iff any fail). | Closes the dangling dependency; makes phase 9 runnable; the contract `/check` already resolves to. |
| F-2 | **AI-actionable output contract** — every gate emits a stable name, pass/fail status, duration, and on failure a log pointer + short excerpt, using stable machine-parseable prefixes/tags so `@runner`/`@fixer` can consume it. | Turns raw gate output into agent-actionable signal (the "AI-tuned" requirement). |
| F-3 | **Gate discovery & extensibility** — resolve the gate set from `AGENTS.md` (preferred) else a documented built-in default set; projects add/override gates without editing the script's core. | Scaffolding usable across ADOS-managed projects; honors the `/check` resolution contract. |
| F-4 | **Selection/argument contract** — `all` (default), named-gate selection, and tolerant handling of the `[fast|slow|all|<gate>...]` args the `/check` command passes; the taxonomy is documented honestly (implemented vs future). | Honest, non-over-engineered contract for the args the command forwards. |
| F-5 | **Contract test suite** — `scripts/.tests/test-quality-gates.sh` proves resolution, per-gate reporting, exit codes, AI-actionable output, and arg handling, including a regression-guard negative case. | Prevents false-greens and silent regressions; auto-picked-up by `test-all.sh` and CI. |
| F-6 | **Operator guide** — `doc/guides/quality-gates.md` documents running/configuring/extending gates plus the AI-tuned output contract, exit codes, and log locations (`ados_distribution: redistributable`). | "Document how to use" — redistributable to adopting projects. |
| F-7 | **Deterministic resolution wiring** — `AGENTS.md` carries the minimal honest declaration pointing at the runner/gate set, so `/check` → `@runner` → `scripts/quality-gates.sh` resolves deterministically. | Makes NFR-1 "deterministic resolution" real instead of relying on the fallback. |
| F-8 | **System-spec reconciliation & no-regression** — `feature-quality-gates-and-pr.md` reflects the now-real runner (component table, NFR-1, testing approach); the change introduces no marker/plugin/shellcheck drift. | Keeps the spec mirror truthful; preserves existing invariants. |

### 5.1 Capability Details

**F-1 — Runner.** `scripts/quality-gates.sh` is a stdlib-bash (Bash 4.0+) orchestrator conforming to `.ai/rules/bash.md` (strict mode + traps, stable `LOG_TAG`, env-injectable settings, testable main guard, documented exit codes). It runs each gate as a discrete unit, captures that gate's exit code and wall-clock duration, and computes an overall exit code: **0 iff every gate passes; non-zero iff any gate fails — there is no third outcome.** It must **invoke** the repo's existing gates rather than reimplement them; the built-in default set appropriate for THIS repo includes at minimum `scripts/test-all.sh`, the GH-67 doc-distribution drift guard, the plugin-freshness check (run `build-claude-plugin.sh` then assert `.ados-claude/` is clean), and `git diff --check`. The runner never masks a gate failure (RSK-4).

**F-2 — AI-actionable output contract.** The summary is structured and stable: each gate entry carries a stable gate name, a pass/fail status, and a duration; on failure it additionally carries a log pointer to the canonical log location and a short failure excerpt (bounded line count). Output uses stable prefixes/tags (per bash.md §5 LOG_TAG convention) so a downstream agent can parse which gates failed and where to look, without scraping free-form prose. The summary is emitted to stdout; errors/diagnostics to stderr.

**F-3 — Discovery & extensibility.** The runner first attempts to resolve the gate set / runner from `AGENTS.md` (matching the `/check` resolution contract step 1). If `AGENTS.md` declares no explicit instruction, it falls back to a documented built-in default gate set (appropriate to this repo). Projects can add or override a gate through the documented extension point (configuration/declaration) **without editing the script's core logic** — keeping it scaffolding, not a per-project fork.

**F-4 — Selection/args.** The runner accepts the args the `/check` command forwards (`[fast|slow|all|<gate>...]`). The honest minimum contract: **no args ⇒ run all gates**; **one or more named gates ⇒ run only those** (unknown selectors tolerated per documented semantics — ignored or warned, never a hard crash that masks real failures). The full `fast`/`slow` partition is documented honestly: implemented selectors vs future (OQ-1). The runner always operates from repo root (resolution contract step 4).

**F-5 — Test suite.** `scripts/.tests/test-quality-gates.sh` follows the repo's `test-*.sh` convention (see `.tests/test-doc-distribution.sh` and `.ai/rules/bash.md` §11). It proves: gate resolution (built-in default + AGENTS.md-honored), per-gate reporting fields, the exit-code contract (0 on all-pass; non-zero on a deliberately injected failing-gate fixture — the regression guard), the AI-actionable output shape, and arg handling (all / named-gate / tolerant). It is discovered automatically by `scripts/test-all.sh` and the CI `bash-tests` `find … -exec` rule — no manual wiring.

**F-6 — Guide.** `doc/guides/quality-gates.md` is a new redistributable guide (frontmatter `ados_distribution: redistributable`) covering: how to run gates (directly and via `/check`); how to declare the gate set / runner in `AGENTS.md`; how to add a project-specific gate via the extension point; the AI-tuned output contract (fields, prefixes, log pointers); exit-code semantics; and log locations. It cross-links (does not duplicate) `feature-quality-gates-and-pr.md`, `.ai/rules/bash.md`, and the change-lifecycle guide (phase 9).

**F-7 — Resolution wiring.** `AGENTS.md` gains the minimal honest declaration that names the runner / gate set, so the `/check` resolution contract's step 1 (not just the step-2 fallback) resolves. The declaration stays minimal and truthful (it does not invent gates that do not exist). This is what makes NFR-1's "deterministic resolution" a lived property rather than a fallback that happens to work.

**F-8 — Reconciliation & no-regression.** `feature-quality-gates-and-pr.md` is reconciled surgically: its Core Components table gains `scripts/quality-gates.sh`; NFR-1's "default" language is reconciled with the now-real runner and the AGENTS.md declaration; the Testing Approach moves from "Manual"-only toward the automated suite (F-5). No unrelated edits. Cross-cutting no-regression invariants: the GH-67 drift guard stays green (the new guide carries its marker); the plugin-freshness check stays green; shellcheck (`error` severity) stays green; `.ados-claude/` is regenerated **iff** a `.opencode/` source changed, else untouched.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Run all gates on a clean tree (the canonical path, now real)
  Human/agent invokes /check  →  @runner resolves gates from AGENTS.md (preferred) → scripts/quality-gates.sh
  → runner invokes each gate (test-all, doc-distribution guard, plugin freshness, git diff --check, …)
  → captures per-gate exit code + duration  → all pass → emits AI-actionable summary (all PASS) → exit 0
  → @runner returns summary + log pointers under tmp/run-logs-runner/<YYYY-MM-DD>/

Flow 2 — A gate fails (the AI-actionable failure path)
  /check  →  runner invokes gates  →  one gate fails (non-zero)
  → runner reports that gate: name, FAIL, duration, log pointer + short excerpt
  → overall exit code non-zero  →  summary names exactly which gate(s) failed and where to look
  → (for /check-fix) @fixer consumes the structured summary → diagnoses/fixes → @committer one Conventional Commit

Flow 3 — Project extends the gate set (scaffolding, no core edit)
  Adopting project declares its gate(s) via the documented AGENTS.md/extension point
  → runner resolves the declared set (project gate + built-in defaults per documented precedence)
  → runs them in one pass → same exit-code + reporting contract

Flow 4 — Phase 9 of the lifecycle is exercised
  delivery phase 9 (quality_gates)  →  /check or /check-fix  →  Flow 1 or Flow 2
  → phase 9 is concretely runnable through the canonical command (was: unrunnable)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- **New `scripts/quality-gates.sh`** — the AI-tuned runner/orchestrator (stdlib bash, `.ai/rules/bash.md`): resolves gates (AGENTS.md preferred, else documented built-in default set); runs each gate; captures per-gate exit code + duration + short failure excerpt; emits a structured AI-actionable summary with log pointers; exits non-zero if any gate fails; supports `all` (default) + named-gate selection and tolerates/documents the `[fast|slow|all|<gate>...]` args. Descriptive comment header (no hand-added license block).
- **New `scripts/.tests/test-quality-gates.sh`** — bash test suite proving the contract (resolution, per-gate reporting, exit codes, AI-actionable output, arg handling) including a regression-guard negative case (injected failing gate → reported + non-zero exit). Follows the `test-*.sh` convention; auto-discovered by `scripts/test-all.sh` and CI `bash-tests`.
- **New `doc/guides/quality-gates.md`** — operator guide; declares `ados_distribution: redistributable`; documents running/configuring/extending gates + AI-tuned output contract + exit codes + log locations.
- **Reconcile `doc/spec/features/feature-quality-gates-and-pr.md`** — surgical update so the dangling reference is a real component (component table, NFR-1, Testing Approach). Keep it minimal.
- **Wire `AGENTS.md`** — the minimal honest declaration naming the runner/gate set, so `/check` resolution is deterministic (not reliant on the missing-file fallback).
- **Regenerate `.ados-claude/`** — **only if** a `.opencode/` source changes. If no agent/command source changes (expected), do NOT regenerate. If `AGENTS.md`-only or script/guide/spec edits, `.ados-claude/` stays untouched.
- **License headers** — `scripts/` is not an `add-header-location.sh` default path; `scripts/*.sh` follow the established descriptive-comment-header convention. The AI does not hand-add license headers (AGENTS.md rule). The new guide gets its header via the existing mechanism for `doc/guides/`.

### 7.2 Out of Scope

- [OUT] Hard-NFR enforcement policy (every hard NFR must have an automated assertion OR structural rule) — deferred companion ticket (NG-2a).
- [OUT] Config-vs-code early gate (smoke config before the Definition of Ready) — deferred companion ticket (NG-2b).
- [OUT] `ados check` / `ados quality-gates` CLI command (epic #49) — separate ticket.
- [OUT] Test-execution evidence gate (#93) — separate ticket.
- [OUT] Rewriting `/check` or `/check-fix` command/agent definitions beyond making resolution work (their delegation is unchanged).
- [OUT] Reimplementing test discovery / a parallel test framework — the runner invokes existing gates (NG-1).
- [OUT] A full `fast`/`slow` gate taxonomy beyond the honest minimum (NG-6; OQ-1).
- [OUT] Retroactively reshaping CI job structure (the runner reads/invokes existing gates; it does not rewire `.github/workflows/ci.yml` jobs).

### 7.3 Deferred / Maybe-Later

- **Hard-NFR enforcement + config-vs-code early gate** — the two owner-comment policies; substantial, worth their own design. Proposed companion ticket.
- **`fast`/`slow` gate partition** — partition gates by typical duration once a real need exists; until then `all` + named-gate is the honest contract (OQ-1).
- **`ados check` CLI** (epic #49) and **test-execution evidence gate** (#93) — separate tickets, cross-linked.
- **Extending the runner to consume project-local gate plugins** discovered from a convention path (beyond the documented AGENTS.md/extension point) — future once adopter demand appears.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface. The runner is a CLI invoked by `/check`/`@runner`.

### 8.2 Events / Messages

N/A — no event/message surface. The runner's "message" is its structured stdout summary (F-2).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Per-gate report record | The stable shape emitted per gate: `{gate name, status (pass/fail), duration, [on failure] log pointer + short excerpt}`. Consumed by `@runner`/`@fixer`. |
| DM-2 | AGENTS.md gate declaration | The minimal, machine-resolvable declaration in `AGENTS.md` naming the runner and/or gate set that the `/check` resolution contract step 1 reads (F-7). |
| DM-3 | Exit-code contract | Scalar: `0` ⇔ all gates pass; non-zero ⇔ ≥1 gate fails. No third state (NFR-3). |

### 8.4 External Integrations

N/A — runs on the standard GitHub Actions `ubuntu-latest` runner with stdlib bash; no third-party APIs. The runner invokes existing repo-internal gates only.

### 8.5 Backward Compatibility

- **Additive.** The runner is a new file; no existing gate is removed or its behavior changed. The runner *invokes* existing gates (NG-1), it does not alter them.
- **`/check`/`/check-fix` become functional** where they previously failed at resolution — this is the intended, spec-mandated behavior (NFR-1), not a regression.
- **`feature-quality-gates-and-pr.md` reconciliation is editorial** (component table + NFR-1 wording + Testing Approach); no capability semantics change.
- **`AGENTS.md` declaration is additive** and truthful (names a runner/gate set that now exists).
- **`.ados-claude/` is regenerated iff** a `.opencode/` source changed; the 1:1 invariant is preserved. Script/guide/spec/AGENTS.md edits do not by themselves require regeneration.
- **Drift guard stays green** — the new guide carries `ados_distribution: redistributable`; no marker drift.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism — same repo state yields the same pass/fail verdict and gate ordering across repeated runs | 100% reproducible (no time/randomness/ordering dependence); stable gate order |
| NFR-2 | Performance — orchestrator overhead (gate dispatch + reporting) is negligible vs the gates themselves | Orchestrator overhead < 2s wall-clock; full run completes within the sum of underlying gate durations (no gratuitous re-runs) |
| NFR-3 | Exit-code contract — exactly two outcomes | 0 iff all gates pass; non-zero iff ≥1 gate fails; no third state |
| NFR-4 | Dependencies — orchestrator is stdlib only | Bash 4.0+ stdlib; no new runtime deps beyond what the orchestrated gates already require; test suite needs no network |
| NFR-5 | AI-actionability — every gate failure is structured | 4/4 fields per gate (name, status, duration, [on fail] log pointer + excerpt); stable machine-parseable prefixes/tags |
| NFR-6 | Bash conventions + lint cleanliness | Conforms to `.ai/rules/bash.md`; shellcheck clean at `error` severity (the CI gate stays green) |
| NFR-7 | CI/test wiring with no manual registration | New suite auto-discovered by `scripts/test-all.sh` and the CI `bash-tests` `find … -exec` rule |
| NFR-8 | Guide distribution honesty | `doc/guides/quality-gates.md` declares `ados_distribution: redistributable`; drift guard green |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The runner emits a clear, machine- and human-readable per-gate summary (DM-1) and an overall verdict with a stable `LOG_TAG` (bash.md §5) to stdout/stderr.
- On failure, the summary names the offending gate(s), the failed condition, the log pointer, and a short excerpt — sufficient for `@fixer` to act without re-running blindly.
- Log artifacts land at the canonical location (OQ-2 proposes `tmp/quality-gates/<YYYY-MM-DD>/`, mirrored by `@runner` under `tmp/run-logs-runner/<YYYY-MM-DD>/` per the `/check` contract).
- No runtime metrics/alerts beyond CI step + agent-consumed summary output (this is a repo-internal build gate).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Runner reimplements/duplicates `test-all.sh` or the gate suites → a parallel test framework | M | M | Hard scope rule (NG-1): the runner **invokes** existing gates as gates; it does not rediscover tests. Enforced by AC-F1-3. | L |
| RSK-2 | `fast`/`slow`/`all`/`<gate>` arg parsing over-engineered or unbounded | M | M | Honest minimum contract (F-4): `all` default + named-gate; document rest as future (OQ-1); tolerant, never a hard crash that masks failures. | L |
| RSK-3 | Dangling-dependency reintroduced — AGENTS.md declaration and script disagree, or resolution picks the wrong path | H | L | AC-F7-1 proves `/check`→`@runner`→script end-to-end; AGENTS.md declares the real script (F-7); test asserts resolution precedence. | L |
| RSK-4 | Runner masks a gate failure (non-zero exit swallowed) → false-green | H | M | `set -e`/`pipefail`/trap discipline (bash.md); regression-guard test injects a failing gate and asserts non-zero exit + per-gate report (AC-F1-4). | L |
| RSK-5 | New redistributable guide breaks the GH-67 drift guard (missing/invalid marker) | L | L | Declare `ados_distribution: redistributable` (NFR-8); AC-F8-2 asserts the guard stays green. | L |
| RSK-6 | Scope creep into the deferred policies (hard-NFR enforcement; config-vs-code gate) bloats delivery | M | L | Explicit non-goals (NG-2/7.2) + proposed companion ticket; this change is scaffolding + docs only (Option A). | L |
| RSK-7 | `.ados-claude/` staleness if a `.opencode/` edit sneaks in without regeneration (or needless regeneration if none) | L | L | AC-F8-3 asserts the 1:1 invariant; regenerate via `scripts/build-claude-plugin.sh` iff `.opencode/` changed. | L |
| RSK-8 | Header-convention ambiguity — AI hand-adds a license block to `scripts/*.sh` | L | L | `scripts/` is not an `add-header-location.sh` default path; follow the descriptive-comment-header convention (bash.md §1/§14); AGENTS.md forbids hand-added headers. | L |
| RSK-9 | Built-in default gate set drifts from what CI actually runs → runner's "green" ≠ CI's "green" | M | M | Default set mirrors the real CI gates (test-all, doc-distribution guard, plugin freshness, `git diff --check`); documented + tested. | L |

## 12. ASSUMPTIONS

- The `/check` resolution contract (`.opencode/command/check.md` §`<resolution>`) is the authoritative interface; the runner honors steps 1–4 (AGENTS.md preferred; fallback `./scripts/quality-gates.sh`; pass-through args; repo-root).
- The repo's real gates today are: `scripts/test-all.sh` (aggregates `scripts/.tests` + `tools/.tests`), `scripts/.tests/test-doc-distribution.sh` (GH-67 guard), `scripts/build-claude-plugin.sh` idempotency (plugin freshness), and `git diff --check`. These are what the built-in default set orchestrates.
- CI `bash-tests` auto-discovers any `*/.tests/test-*.sh` (excluding `./tmp/*` and the documented e2e/performance text-to-image suites) — so a new `scripts/.tests/test-quality-gates.sh` needs no manual CI wiring (NFR-7).
- `scripts/` is not in `add-header-location.sh` `DEFAULT_PATHS`; the established `scripts/*.sh` convention is a descriptive comment header (purpose/deps/usage/env/exit-codes), not a copyright block. The AI does not hand-add headers (AGENTS.md).
- `AGENTS.md` declares no explicit quality-gates runner instruction today (verified); adding the minimal honest declaration (F-7) is additive and truthful.
- The 11-phase lifecycle places `quality_gates` at phase 9 (`AGENTS.md`, `doc/guides/change-lifecycle.md`); making it runnable is the core outcome (G-5).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | `.ai/rules/bash.md` | Authoritative bash conventions the runner + test suite must follow (F-1, F-5, NFR-6). |
| Depends on | `.opencode/command/check.md` (resolution contract) | Defines steps 1–4 the runner must honor; the args it forwards. |
| Depends on | `feature-quality-gates-and-pr.md` (NFR-1) | The spec being made real; reconciled by F-8. |
| Depends on | existing gates: `scripts/test-all.sh`, `scripts/.tests/test-doc-distribution.sh`, `scripts/build-claude-plugin.sh` | The real gates the default set orchestrates (invoked, not reimplemented — NG-1). |
| Depends on | GH-67 marker system (delivered) | Governs the new guide's `ados_distribution` marker (NFR-8). |
| Blocks | epic #49 (`ados check` CLI) | A future CLI wraps this runner. |
| Blocks | #93 (test-execution evidence gate) | Builds on a real runner. |
| Blocks | companion ticket (hard-NFR enforcement + config-vs-code gate) | The deferred owner-comment policies layer on top of a working runner. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the runner implement the `fast`/`slow` partition now (split gates by typical duration), or is `all` (default) + named-gate selection sufficient, with `fast`/`slow` documented as future? | The `/check` command forwards `[fast|slow|all|<gate>...]`; full taxonomy risks over-engineering (RSK-2). | Decision needed: consult `@decision-advisor`. PM leans: `all` + named-gate now; document rest as future (NG-6). |
| OQ-2 | Where exactly do per-gate logs land — `tmp/quality-gates/<YYYY-MM-DD>/` (a dedicated location) or directly under `tmp/run-logs-runner/<YYYY-MM-DD>/` (the `@runner` convention)? | `/check` expects logs under `tmp/run-logs-runner/`; the PM scope lists both. | Decision needed: consult `@decision-advisor`. Proposed default: runner writes `tmp/quality-gates/<date>/`; `@runner` mirrors under `tmp/run-logs-runner/` as it does for any command. |
| OQ-3 | Should `scripts/quality-gates.sh` carry a license copyright header (some repo scripts do, e.g. `add-header-location.sh`) or only the descriptive comment header (the convention for `test-all.sh`/`test-doc-distribution.sh`)? | `scripts/` is not an `add-header-location.sh` default path; conventions are mixed. | Minor; match the established `test-*`/orchestrator convention (descriptive header) unless the owner directs otherwise. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Scope = **Option A** (scaffolding + docs only); the two owner-comment policies are deferred to a companion ticket. | Keeps delivery focused on closing the dangling dependency; the policies are substantial and deserve their own design (NG-2). | 2026-07-04 |
| DEC-2 | The runner **invokes** existing gates; it does not reimplement test/gate discovery (NG-1). | Avoids a parallel test framework; single source of truth stays `test-all.sh` + the guard scripts (RSK-1). | 2026-07-04 |
| DEC-3 | `AGENTS.md` gains the minimal honest declaration (F-7) rather than relying solely on the missing-file fallback. | Makes NFR-1 "deterministic resolution" a lived property; matches the `/check` resolution contract step 1 (RSK-3). | 2026-07-04 |
| DEC-4 | Honest arg contract: `all` (default) + named-gate now; `fast`/`slow` documented as future (OQ-1). | Non-over-engineered; tolerates the args `/check` forwards without masking failures (RSK-2). | 2026-07-04 |
| DEC-5 | New guide is `ados_distribution: redistributable`; `scripts/*.sh` use descriptive comment headers (no hand-added license block). | Guide is generic/reusable (redistributable); `scripts/` is not a header-script default path and the AI must not hand-add headers (RSK-5, RSK-8, AGENTS.md). | 2026-07-04 |
| DEC-6 | Reconcile `feature-quality-gates-and-pr.md` surgically (component table + NFR-1 + Testing Approach); no capability-semantics change. | Keeps the spec mirror truthful without scope creep (F-8). | 2026-07-04 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `scripts/quality-gates.sh` | New — AI-tuned quality-gates runner/orchestrator (F-1, F-2, F-3, F-4) |
| `scripts/.tests/test-quality-gates.sh` | New — contract test suite incl. regression-guard negative case (F-5) |
| `doc/guides/quality-gates.md` | New — operator guide (`ados_distribution: redistributable`) (F-6) |
| `AGENTS.md` | Updated — minimal honest gate-runner/gate-set declaration (F-7) |
| `doc/spec/features/feature-quality-gates-and-pr.md` | Updated — surgical reconciliation: component table, NFR-1, Testing Approach (F-8) |
| `.ados-claude/` | Regenerated **iff** a `.opencode/` source changed; else untouched (F-8) |
| `.github/workflows/ci.yml` | Unchanged — `bash-tests`/`shellcheck` auto-cover the new suite/script (NFR-7) |
| `/check`, `/check-fix` commands | Unchanged (beyond resolution now succeeding) — NG-5 |

## 17. ACCEPTANCE CRITERIA

> Grouped by area; Given/When/Then; each links to ≥1 F-/NFR-/DM- ID. AC-F\* = functional; AC-NFR\* = non-functional.

### A. Runner exists, runs, exits correctly (F-1, F-3, NFR-3, NFR-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `scripts/`, **when** inspected, **then** `scripts/quality-gates.sh` exists and is executable. | F-1 |
| AC-F1-2 | **Given** a clean repo tree, **when** `scripts/quality-gates.sh` is run with no args, **then** it exits 0 and reports all gates passing with AI-actionable structured output. | F-1, F-2, NFR-3 |
| AC-F1-3 | **Given** the built-in default gate set, **when** inspected/run, **then** it **invokes** (not reimplements) at minimum `scripts/test-all.sh`, the doc-distribution drift guard, the plugin-freshness check (`build-claude-plugin.sh` idempotency), and `git diff --check`. | F-1, F-3 |
| AC-F1-4 | **Given** a deliberately failing gate (test fixture), **when** the runner executes, **then** it reports that gate as failed (with log pointer + short excerpt) **and** exits non-zero. | F-1, F-2, NFR-3 |

### B. AI-actionable output contract (F-2, NFR-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** any gate run, **when** the summary is emitted, **then** each gate entry includes a stable name, a pass/fail status, and a duration. | F-2, NFR-5 |
| AC-F2-2 | **Given** a failing gate, **when** reported, **then** the summary includes a log pointer and a short failure excerpt using stable, machine-parseable prefixes/tags. | F-2, NFR-5 |

### C. Gate discovery & extensibility (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** `AGENTS.md` declares the runner/gate set (DM-2), **when** the runner resolves gates, **then** it honors that declaration (preferred); otherwise it uses the documented built-in default set. | F-3 |
| AC-F3-2 | **Given** a project adds/overrides a gate via the documented extension point, **when** the runner runs, **then** the project gate takes effect per documented precedence **without** editing the script's core. | F-3 |

### D. Selection/argument contract (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** the runner is invoked with no args, **when** it runs, **then** it runs all gates (default = `all`). | F-4 |
| AC-F4-2 | **Given** the runner is invoked with one or more named gates, **when** it runs, **then** it runs only the named gates and tolerates unknown selectors per documented semantics (no hard crash that masks real failures). | F-4 |
| AC-F4-3 | **Given** the runner's `--help`/usage, **when** read, **then** it documents the `[fast|slow|all|<gate>...]` taxonomy and which selectors are implemented vs future. | F-4 |

### E. Contract test suite (F-5, NFR-6, NFR-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** `scripts/.tests/`, **when** inspected, **then** `test-quality-gates.sh` exists, is executable, follows the `test-*.sh` convention, and proves resolution, per-gate reporting, exit codes, AI-actionable output, and arg handling (incl. the regression-guard negative case). | F-5, NFR-6 |
| AC-F5-2 | **Given** `scripts/test-all.sh` and the CI `bash-tests` job, **when** run, **then** the new suite is auto-discovered and executed with no manual wiring. | F-5, NFR-7 |

### F. Operator guide (F-6, NFR-8)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** `doc/guides/`, **when** inspected, **then** `quality-gates.md` exists and declares `ados_distribution: redistributable` in its frontmatter. | F-6, NFR-8 |
| AC-F6-2 | **Given** the guide, **when** read, **then** it documents running gates (directly + via `/check`), declaring gates in `AGENTS.md`, adding a project-specific gate, the AI-tuned output contract, exit-code semantics, and log locations. | F-6 |

### G. Deterministic resolution wiring (F-7, NFR-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the `/check` → `@runner` → `scripts/quality-gates.sh` resolution path, **when** exercised end-to-end on a clean tree, **then** it resolves and runs the real runner, lands logs under the `@runner` `tmp/run-logs-runner/` convention, and returns a structured summary. | F-7, NFR-1 |
| AC-F7-2 | **Given** `AGENTS.md`, **when** read, **then** it carries the minimal honest declaration naming the runner/gate set (no invented gates). | F-7 |

### H. Reconciliation & no-regression (F-8)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** `feature-quality-gates-and-pr.md`, **when** reconciled, **then** its Core Components table includes `scripts/quality-gates.sh`, NFR-1 reflects the now-real runner + AGENTS.md declaration, and the Testing Approach references the automated suite — with no unrelated edits. | F-8 |
| AC-F8-2 | **Given** the GH-67 doc-distribution drift guard, **when** run, **then** it stays green (the new redistributable guide carries its marker; no marker drift). | F-8, NFR-8 |
| AC-F8-3 | **Given** `.ados-claude/`, **when** delivery completes, **then** it is current — regenerated via `scripts/build-claude-plugin.sh` **iff** a `.opencode/` source changed, else untouched. | F-8 |
| AC-F8-4 | **Given** the plugin-freshness check and `shellcheck` (`error` severity), **when** run, **then** both stay green. | F-8, NFR-6 |

### I. Non-functional (NFR-1, NFR-2, NFR-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** the same repo state, **when** the runner is executed twice, **then** it produces the same pass/fail verdict and gate ordering (deterministic, no time/randomness dependence). | NFR-1 |
| AC-NFR2-1 | **Given** a full gate run on a clean tree, **when** timed, **then** orchestrator overhead (dispatch + reporting) is < 2s wall-clock and the run completes within the sum of underlying gate durations (no gratuitous re-runs). | NFR-2 |
| AC-NFR4-1 | **Given** the runner and its test suite, **when** inspected, **then** the orchestrator depends only on Bash 4.0+ stdlib (no new runtime deps beyond what the gates require) and the test suite needs no network. | NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Deliver the runner, its test suite, the guide, the AGENTS.md declaration, and the spec reconciliation in a single PR (Option A — scaffolding + docs).
2. Verify the runner is green on the current clean repo as the baseline before relying on it as the canonical `/check` target.
3. Do **not** regenerate `.ados-claude/` unless a `.opencode/` source changed.
4. On merge, `/check` and `/check-fix` resolve to a real runner; `quality_gates` (phase 9) is runnable; adopters gain a redistributable guide and extensible scaffolding.
5. Communicate internally: maintainers should expect `/check` to now run gates deterministically; the deferred policies are tracked as a proposed companion ticket.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data. The runner's only state is ephemeral logs under `tmp/` (git-ignored) and the per-run summary.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal data is processed. The runner invokes repo-internal gates on the working tree; logs stay under git-ignored `tmp/`.

## 21. SECURITY REVIEW HIGHLIGHTS

- The runner executes repo-internal gates only; it does not source untrusted files or run commands from untrusted input (bash.md §1).
- No secrets, tokens, or credentials are involved; `tmp/` and `.ai/local/` remain out of any commit surface (the runner does not commit — that is `@committer`'s role).
- Argument handling is tolerant and bounded (F-4); unknown selectors do not cause destructive behavior.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing:** adding or overriding a gate is a configuration/declaration change (documented extension point), not a core-script edit (F-3). The default set should be kept in sync with what CI actually runs (RSK-9).
- **Operations:** `/check`/`/check-fix` now have a deterministic target; phase 9 is exercisable. One new test suite joins `bash-tests` (negligible runtime — it tests the orchestrator contract, not the full gate suite).
- **No new CI job** — the new suite is auto-discovered; the runner reads/invokes existing gates and does not rewire CI jobs.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Quality-gates runner | `scripts/quality-gates.sh` — the AI-tuned orchestrator that runs the repo's gates in one deterministic pass (F-1). |
| AI-tuned output | Per-gate structured summary (name, status, duration, [on fail] log pointer + excerpt) with stable machine-parseable prefixes, consumable by `@runner`/`@fixer` (F-2). |
| Dangling dependency | A documented reference (`scripts/quality-gates.sh`) with no implementing file — the gap this change closes. |
| `quality_gates` (phase 9) | The 11-phase lifecycle's gate-running phase, run via `/check`/`/check-fix` (G-5). |
| Resolution contract | `/check`'s 4-step rule for picking the gates command (AGENTS.md preferred → fallback `./scripts/quality-gates.sh` → pass args → repo root). |
| Default gate set | The documented built-in gates the runner orchestrates when `AGENTS.md` declares nothing (test-all, doc-distribution guard, plugin freshness, `git diff --check`). |

## 24. APPENDICES

- **Appendix A — The dangling dependency, mapped.** `feature-quality-gates-and-pr.md` NFR-1 + Dependencies (line 109); `.opencode/command/check.md` §`<resolution>` (fallback `./scripts/quality-gates.sh`); `.opencode/command/check-fix.md` (runs "quality gates"); `doc/guides/onboarding-existing-project.md` (references the runner). All point at a file that does not exist (verified). `AGENTS.md` declares no explicit runner instruction (verified).
- **Appendix B — The real gates the default set orchestrates.** `scripts/test-all.sh` (aggregates `scripts/.tests` + `tools/.tests` `test-*.sh`); `scripts/.tests/test-doc-distribution.sh` (GH-67 5-mode drift guard); `scripts/build-claude-plugin.sh` idempotency (CI `verify-claude-build` checks `.ados-claude/` is clean after a rebuild); `git diff --check` (whitespace/conflict-marker hygiene). CI jobs: `verify-claude-build`, `doc-distribution-guard`, `inception-doc-consistency`, `bash-tests` (`find … -exec`, installs `jq`), `shellcheck` (`error` severity).
- **Appendix C — Deferred items (explicit).** (1) Hard-NFR enforcement policy; (2) config-vs-code early gate — proposed companion ticket. (3) `ados check` CLI — epic #49. (4) Test-execution evidence gate — #93.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-04 | @spec-writer | Initial specification for GH-37 (AI-tuned quality-gates runner + operator guide; close the `/check` dangling dependency) |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue GH-37 + owner-comment context (PM-provided summary, authoritative); authoritative repo artifacts read and reconciled during authoring — `feature-quality-gates-and-pr.md` (the spec being made real), `.opencode/command/{check,check-fix}.md` (the resolution contract), `scripts/test-all.sh` and `scripts/.tests/test-doc-distribution.sh` (the test convention + real gates), `.ai/rules/bash.md` (bash conventions), `AGENTS.md` (header rules, scripts/tools conventions, `ados_distribution` marker rule), `scripts/add-header-location.sh` (`DEFAULT_PATHS` — scripts/ excluded), and `.github/workflows/ci.yml` (the `bash-tests`/`shellcheck` jobs).
- The dangling dependency was independently verified (the script does not exist; AGENTS.md declares no runner instruction) rather than taken on faith — this is the change's root cause.
- The header convention for `scripts/` was verified against `add-header-location.sh` `DEFAULT_PATHS` (line 46) and the existing `scripts/*.sh` descriptive-comment-header pattern — not assumed from the AGENTS.md "required paths" list alone.
- CI auto-discovery of `*/.tests/test-*.sh` was verified in `.github/workflows/ci.yml` (`bash-tests` job), confirming the new suite needs no manual wiring (NFR-7).
- The two owner-comment policies were treated as explicitly deferred (NG-2 / 7.3), not implemented — preserving the Option A scaffolding+docs scope per the PM input.
- File paths are cited for traceability and scope definition (matching the GH-67/GH-78 exemplar convention), not as step-by-step implementation instructions; the plan-writer derives tasks from this scope.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-37)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths as instructions, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
