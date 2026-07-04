---
id: chg-GH-37-ai-tuned-quality-gates-script
status: Proposed
created: 2026-07-04T01:41:12Z
last_updated: 2026-07-04T01:41:12Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["quality-gates", "scripts", "docs", "runner", "phase-9"]
links:
  change_spec: ./chg-GH-37-spec.md
  test_plan: ./chg-GH-37-test-plan.md
  related_changes:
    - GH-78
    - GH-67
summary: >
  AI-tuned quality-gates runner script + operator guide (GH-37) — closes the
  /check dangling dependency by creating scripts/quality-gates.sh, an AI-tuned
  stdlib-bash orchestrator that discovers the gate set (AGENTS.md preferred,
  else a documented built-in default set), invokes (does not reimplement) the
  repo's real gates in one deterministic pass, captures per-gate exit code +
  duration + a short failure excerpt, emits an AI-actionable structured summary
  with log pointers, and exits non-zero if any gate fails. Delivers the contract
  test suite (auto-discovered by test-all.sh + CI bash-tests), a redistributable
  operator guide, the minimal honest AGENTS.md resolution declaration, and a
  surgical reconciliation of feature-quality-gates-and-pr.md. Deferred: hard-NFR
  enforcement + config-vs-code gate (companion ticket), ados check CLI (#49),
  test-execution evidence gate (#93).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-37: AI-tuned quality-gates runner script + operator guide (close the /check dangling dependency)

## Context and Goals

This plan operationalizes `chg-GH-37-spec.md`: close the repo's documented,
dangling dependency by creating the missing `scripts/quality-gates.sh` — the
AI-tuned runner/orchestrator that `feature-quality-gates-and-pr.md` (NFR-1 +
Dependencies line 109), `.opencode/command/check.md` §`<resolution>` (fallback
`./scripts/quality-gates.sh`), `.opencode/command/check-fix.md`, and
`doc/guides/onboarding-existing-project.md` all already resolve to — but which
does **not exist** today, and which `AGENTS.md` declares no explicit runner
instruction for. Today every `/check` invocation fails at resolution; the
`quality_gates` lifecycle phase (9) is effectively unrunnable through the
canonical command.

The change is **Option A — scaffolding + docs only** (DEC-1): the runner
**invokes** the repo's existing real gates (`scripts/test-all.sh`, the GH-67
doc-distribution drift guard, the plugin-freshness check via
`scripts/build-claude-plugin.sh` idempotency, and `git diff --check`) — it does
**not** reimplement test/gate discovery (NG-1, RSK-1). It adds the contract
test suite, a redistributable operator guide, the minimal honest `AGENTS.md`
resolution declaration, and a surgical reconciliation of the feature spec. The
two substantial owner-comment policies (hard-NFR enforcement; config-vs-code
early gate) are explicitly **deferred** to a proposed companion ticket.

This is one logical set of changes delivered as a single PR; `@coder` commits
per-phase via `@committer` (Conventional Commits, e.g. `feat(GH-37): ...`).
The PM/committer owns commits; this plan describes tasks only.

**PM-resolved decisions (encoded as fact — NOT re-litigated here):**

- **OQ-1 (DEC-4)** — arg contract = `all` (default) + named-gate selection
  **now**; `fast`/`slow` documented as **future**; unknown selectors
  **tolerated** (warned/ignored, **never** a hard crash that masks a real
  failure).
- **OQ-2** — the runner writes structured per-gate output to the canonical
  output dir `tmp/quality-gates/<YYYY-MM-DD>/`; `@runner` (via `/check`) mirrors
  command output under `tmp/run-logs-runner/<YYYY-MM-DD>/` as it does for any
  command (out of the runner script's direct responsibility; documented in the
  guide).
- **OQ-3 (DEC-5)** — `scripts/quality-gates.sh` uses a **descriptive comment
  header** (purpose/deps/usage/env/exit-codes per `.ai/rules/bash.md` §1/§14)
  with **no** hand-added license/copyright block — matching the established
  `test-all.sh` / `test-doc-distribution.sh` convention (`scripts/` is not an
  `add-header-location.sh` default path).
- **DEC-1..6** govern: Option A scope; runner invokes (not reimplements); the
  AGENTS.md minimal honest declaration makes NFR-1 "deterministic resolution" a
  lived property; the guide is `ados_distribution: redistributable`; the
  feature spec is reconciled **surgically**.

**Open questions** (non-blocking, carried from spec §14 / test-plan §8.3):

- **OQ-T1** — the exact per-gate field syntax the runner emits (e.g.
  `name=… status=… duration=…` vs. a tagged multi-line block). Resolved at
  delivery by `@coder`; the suite (TC-QGATES-002/004) and guide (TC-QGATES-012)
  MUST pin the same form. *Decision needed at delivery; not a blocker.*
- **OQ-T3** — whether the real clean-tree default-gate run (TC-QGATES-002/013)
  is fast enough for the unit suite, or whether the suite always uses fixture
  gates and reserves the real run for CI. Delivery-time decision by `@coder`.

**Environment constraint (important):** `shellcheck` / `shfmt` / `actionlint`
may NOT be installed locally; they run in CI. The script conforms to
`.ai/rules/bash.md`; local verification uses `bash -n` (syntax check) + the test
suites. Do **not** block delivery on a missing local `shellcheck` — CI is the
authoritative lint gate (see TC-QGATES-018's "if present" structure).

---

## Scope

### In Scope

- **F-1** — `scripts/quality-gates.sh` (new): stdlib-bash (Bash 4.0+) orchestrator
  conforming to `.ai/rules/bash.md`; resolves the gate set (AGENTS.md preferred,
  else documented built-in default set); invokes each gate as a discrete unit;
  captures per-gate exit code + wall-clock duration; computes a single honest
  overall exit code (0 iff all pass; non-zero iff any fail — no third state);
  never masks a gate failure. (AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-4)
- **F-2** — AI-actionable output contract: each gate entry carries a stable name,
  pass/fail status, duration; on failure additionally a log pointer + short
  bounded excerpt; stable machine-parseable prefixes/tags; summary to stdout,
  diagnostics to stderr. (AC-F2-1, AC-F2-2)
- **F-3** — Gate discovery & extensibility: resolve from AGENTS.md (preferred)
  else documented built-in default set; projects add/override gates via the
  documented extension point **without editing the script's core**. (AC-F3-1,
  AC-F3-2)
- **F-4** — Selection/argument contract: `all` (default) + named-gate now;
  `fast`/`slow` documented as future; unknown selectors tolerated (warned/
  ignored, never fatal-masking); always from repo root. (AC-F4-1, AC-F4-2,
  AC-F4-3)
- **F-5** — `scripts/.tests/test-quality-gates.sh` (new): contract test suite
  following the `test-*.sh` convention + embedded framework (bash.md §11);
  proves resolution, per-gate reporting, exit codes, AI-actionable output, arg
  handling, determinism, performance, stdlib-only, **and** the regression-guard
  negative case (injected failing gate → reported + non-zero exit); hermetic;
  auto-discovered by `scripts/test-all.sh` and CI `bash-tests`. (AC-F5-1,
  AC-F5-2, AC-NFR1-1, AC-NFR2-1, AC-NFR4-1)
- **F-6** — `doc/guides/quality-gates.md` (new): operator guide declaring
  `ados_distribution: redistributable`; documents running (direct + via `/check`),
  declaring in `AGENTS.md`, adding a project gate, the AI-tuned output contract,
  exit codes, log locations; cross-links canonical sources. (AC-F6-1, AC-F6-2)
- **F-7** — `AGENTS.md` (edited): minimal honest declaration naming the runner /
  gate set so `/check` → `@runner` → `scripts/quality-gates.sh` resolves
  deterministically (not just the missing-file fallback). (AC-F7-2)
- **F-8** — `doc/spec/features/feature-quality-gates-and-pr.md` (edited): surgical
  reconciliation (Core Components table + NFR-1 + Testing Approach); no
  unrelated edits. `.ados-claude/` regenerated **iff** a `.opencode/` source
  changed (expected: **none** — NG-5). (AC-F8-1, AC-F8-3)

### Out of Scope

- **NG-1** — no reimplementation of test/gate discovery; the runner **invokes**
  existing gates.
- **NG-2** — the two owner-comment policies (hard-NFR enforcement; config-vs-code
  early gate) are deferred to a proposed companion ticket.
- **NG-3** — no `ados check` / `ados quality-gates` CLI (epic #49).
- **NG-4** — no test-execution evidence gate (#93).
- **NG-5** — no rewrite of `/check` or `/check-fix` command/agent definitions
  beyond making resolution succeed; **no `.opencode/` source change expected**.
- **NG-6** — no full `fast`/`slow` partition (documented as future per OQ-1).
- **NG-7** — no hand-added license headers; `scripts/*.sh` use descriptive
  comment headers (OQ-3 / DEC-5); the new guide's header is applied via
  `scripts/add-header-location.sh doc/guides`.
- **OUT** — no retroactive reshaping of `.github/workflows/ci.yml` job structure
  (the runner reads/invokes existing gates; CI `bash-tests`/`shellcheck` already
  auto-cover the new suite/script).

### Constraints

- **`.ai/rules/bash.md` conformance (NFR-6):** the runner + suite follow §1
  (strict mode `set -Eeuo pipefail` + `errtrace` + `inherit_errexit` + `IFS` +
  traps), §5 (stable `LOG_TAG`), §10 (testability: env injection §10.1, mockable
  wrappers §10.3, testable main guard §10.4, documented exit codes §10.5), §11
  (embedded test framework), §16 (reference skeleton).
- **Stdlib-only orchestrator (NFR-4):** the orchestrator's own code path depends
  only on Bash 4.0+ stdlib; it may delegate to gates that use `jq` etc. (gates'
  own deps are out of scope). The test suite needs no network.
- **Exit-code contract (NFR-3):** exactly two outcomes — 0 iff all gates pass;
  non-zero iff ≥1 fails; no third state.
- **Determinism (NFR-1):** same repo state ⇒ same pass/fail verdict + stable gate
  ordering; no time/randomness/ordering dependence.
- **Performance (NFR-2):** orchestrator overhead (dispatch + reporting) < 2s
  wall-clock; completes within the sum of underlying gate durations (no
  gratuitous re-runs).
- **Header convention (OQ-3 / DEC-5 / RSK-8):** `scripts/quality-gates.sh` carries
  a descriptive comment header (purpose/deps/usage/env/exit-codes), **not** a
  license block. AGENTS.md forbids AI hand-adding headers. The new guide gets its
  header via `scripts/add-header-location.sh doc/guides` (a default path).
- **`.ados-claude/` 1:1 invariant (NFR / RSK-7):** regenerate via
  `scripts/build-claude-plugin.sh` **iff** a `.opencode/` source changed; else
  untouched. Expected: **no** `.opencode/` change in this delivery (NG-5) ⇒
  `.ados-claude/` MUST remain untouched (the "empty-diff" branch, TC-QGATES-017).
- **Drift guard (NFR-8 / RSK-5):** the new guide declares
  `ados_distribution: redistributable` so `test-doc-distribution.sh` stays green.
- **Lint environment:** `shellcheck`/`shfmt`/`actionlint` may be absent locally;
  CI is authoritative. Local verification uses `bash -n` + the test suites. Do
  not block on a missing local `shellcheck`.

### Risks

- **RSK-1 (reimplementing gates → parallel framework):** mitigated by the hard
  scope rule (NG-1) — the runner **invokes** existing gates; the default-set
  registry references the real gate identifiers, not rediscovery logic. Enforced
  by AC-F1-3 / TC-QGATES-003.
- **RSK-2 (arg over-engineering):** mitigated by the honest minimum contract
  (OQ-1 / DEC-4) — `all` + named-gate now; `fast`/`slow` future; unknown
  selectors tolerated, never fatal-masking.
- **RSK-3 (dangling-dependency reintroduced via declaration/script disagreement):**
  mitigated by AC-F7-1 (end-to-end resolution) + AC-F7-2 (honest AGENTS.md
  declaration) + the resolution-precedence test (TC-QGATES-007).
- **RSK-4 (runner masks a gate failure → false-green) — the most important:**
  mitigated by strict-mode/trap discipline (bash.md) + the regression-guard test
  (AC-F1-4 / TC-QGATES-004) that injects a failing gate and asserts non-zero
  exit + per-gate report.
- **RSK-7 (`.ados-claude/` staleness / needless regeneration):** mitigated by
  AC-F8-3 / TC-QGATES-017 (assert the 1:1 invariant).
- **RSK-8 (header-convention ambiguity):** mitigated by OQ-3 / DEC-5 —
  descriptive comment header, no hand-added license block.
- **RSK-9 (default-set drift from CI):** mitigated by TC-QGATES-003 pinning the 4
  real gate identifiers; the default set mirrors the real CI gates.

### Success Metrics

| Metric | Target |
|--------|--------|
| `/check` resolves + runs a real runner on a clean tree (exit 0, all gates passing) | 1 / 1 (end-to-end dogfood) |
| Real repo gates orchestrated (invoked, not reimplemented) | ≥ 4 (test-all, doc-distribution guard, plugin freshness, `git diff --check`) |
| Per-gate report fields emitted (name, status, duration, [on fail] log pointer + excerpt) | 4 / 4 (100% of gates) |
| Exit-code determinism (0 iff all pass; non-zero iff ≥1 fails; no third state) | 100% |
| New contract suite auto-discovered by `scripts/test-all.sh` + CI `bash-tests` | 1 / 1 (no manual wiring) |
| New guide declaring `ados_distribution: redistributable`; drift guard green | 1 / 1 |
| No-regression on plugin freshness, shellcheck (`error`), doc-distribution guard | all green |
| `.ados-claude/` regenerated iff `.opencode/` sources changed | 1:1 invariant (expected: untouched) |
| AC coverage | 24 / 24; TC coverage 21 / 21 |

---

## Phases

> Each phase = one logical unit; `@coder` stages the explicit paths and commits
> via `@committer` (Conventional Commits, e.g. `feat(GH-37): ...`). The PM/
> committer owns commits; this plan describes tasks only. Use **explicit-path**
> `git add` only — never `git add -A`/`.`; never stage `tmp/`, `.ai/local/`, or
> the change folder's PM-owned `chg-GH-37-pm-notes.yaml`.

### Phase 1: Runner scaffolding & core (strict-mode skeleton + help)

**Goal**: Create `scripts/quality-gates.sh` as a `.ai/rules/bash.md`-conformant
scaffold: shebang, strict mode + traps, stable `LOG_TAG`, env-injectable
settings, testable main guard, documented exit codes, `--help`, and the
descriptive comment header (no license block). No gate logic yet — that lands in
Phase 2.

**Tasks**:

- [x] **1.1** READ the authoritative inputs (spec §5.1, bash.md §1/5/10/14/16, check.md §resolution, exemplar scripts) — done before authoring. `chg-GH-37-spec.md` §5.1 (F-1..F-8),
  `.ai/rules/bash.md` (esp. §1, §5, §10.1/§10.4/§10.5, §14, §16 reference skeleton),
  `.opencode/command/check.md` §`<resolution>` (steps 1–4 the runner honors),
  and the exemplar scripts `scripts/test-all.sh` + `scripts/.tests/test-doc-distribution.sh`
  (the descriptive-header + strict-mode convention to match). *(owner: @coder; F-1, NFR-6, OQ-3)*
- [x] **1.2** CREATE `scripts/quality-gates.sh` (new, executable) with the
  `.ai/rules/bash.md` skeleton:
  - `#!/usr/bin/env bash`; `set -Eeuo pipefail`; `set -o errtrace`;
    `shopt -s inherit_errexit 2>/dev/null || true`; `IFS=$'\n\t'`.
  - ERR/EXIT/INT/TERM traps per §1; a stable `readonly LOG_TAG="(quality-gates)"` (§5);
    `log_info`/`log_warn`/`log_err`/`log_debug` helpers.
  - A **testable main guard** (`if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi`, §10.4) so the suite can `source` it for unit cases.
  - **Env-injectable settings** (§10.1) for the extension seam (gate set path,
    AGENTS.md path, output-dir root) consumed by Phase 2/5.
  - `-h|--help` handling (§4) printing usage.
  - A **descriptive comment header** (purpose/deps/usage/env/exit-codes per §1/§14)
    with **NO** hand-added license/copyright block (OQ-3 / DEC-5 / RSK-8 —
    `scripts/` is not an `add-header-location.sh` default path).
  - Documented exit codes (§10.5): `0` all gates pass; non-zero (1) ≥1 gate
    failed; `2` usage/invocation error (document the chosen scheme). *(owner: @coder; F-1, AC-F1-1, NFR-3, NFR-6; TC-QGATES-001)*
- [x] **1.3** VERIFY the scaffold locally: `bash -n scripts/quality-gates.sh`
  (syntax clean) and `scripts/quality-gates.sh --help` exits 0 printing usage
  with the `[fast|slow|all|<gate>...]` taxonomy placeholder (full taxonomy text
  finalized in Phase 4). Confirm `chmod +x`. *(owner: @coder; AC-F1-1; TC-QGATES-001)*
- [x] **1.4** HAND to `@committer`: stage `scripts/quality-gates.sh` only and
  commit as one unit. *(owner: @committer)*

**Acceptance Criteria**:

- Must: AC-F1-1 (`scripts/quality-gates.sh` exists + executable + bash.md-conformant
  + descriptive header, no license block) — proven fully by TC-QGATES-001 in Phase 5;
  the scaffold satisfies its static preconditions here.
- Should: `bash -n` clean; `--help` exits 0.

**Files and modules**:

- `scripts/quality-gates.sh` (new — scaffold; Phase 2 adds gate logic)

**System docs to update**:

- none

**Tests**:

- `bash -n scripts/quality-gates.sh` (syntax); manual `--help` smoke.
- Full static-conformance assertions run in Phase 5 (TC-QGATES-001).

**Completion signal**: `feat(GH-37): scaffold quality-gates runner (strict mode, main guard, help)`

---

### Phase 2: Gate dispatch loop + built-in default set + extension seam

**Goal**: Implement the dispatch loop (run each gate as a discrete unit, capture
per-gate exit code + duration, compute the single honest overall exit code),
the **built-in default gate set** that **invokes** (not reimplements) the repo's
real gates, the resolution precedence (AGENTS.md preferred else default), and
the extension seam that lets projects add/override gates without editing core.

**Tasks**:

- [x] **2.1** IMPLEMENT the dispatch core (F-1 / NFR-3): a function that, given a
  resolved ordered gate list, runs each gate as a discrete unit under controlled
  error handling, captures that gate's exit code + wall-clock duration (the
  duration capture is finalized in Phase 3 with the report shape), and computes
  the overall exit code — **0 iff every gate passes; non-zero iff any gate
  fails; no third state**. The runner must **never mask** a gate failure (RSK-4):
  `set -e`/`pipefail`/trap discipline does not swallow a gate's non-zero exit.
  *(owner: @coder; F-1, AC-F1-2, NFR-3, NFR-1, RSK-4)*
- [x] **2.2** DEFINE the **built-in default gate set** registry (F-1, F-3, NG-1,
  RSK-1, RSK-9) as a stable ordered list referencing — i.e. **invoking** — the
  repo's 4 real gates (do **not** reimplement test discovery):
  1. test aggregation: `scripts/test-all.sh`;
  2. doc-distribution drift guard: `scripts/.tests/test-doc-distribution.sh`;
  3. plugin freshness: run `scripts/build-claude-plugin.sh` then assert
     `.ados-claude/` is clean (the CI `verify-claude-build` invariant);
  4. whitespace/conflict-marker hygiene: `git diff --check`.
  Each registry entry exposes a stable gate name + the command it invokes.
  *(owner: @coder; F-1, F-3, AC-F1-3, NG-1; TC-QGATES-003)*
- [x] **2.3** IMPLEMENT resolution precedence (F-3 / DEC-3 / TC-QGATES-007),
  mirroring `/check` §`<resolution>` step 1: first attempt to read the
  gate-set/runner declaration from `AGENTS.md` (env-overridable path so tests
  can point at a fixture declaration); if present, honor it (preferred); else
  fall back to the documented built-in default set (Phase 2.2). Precedence must
  be unambiguous and documented (no double-layering unless the documented rule
  says so). *(owner: @coder; F-3, AC-F3-1, DEC-3; TC-QGATES-007)*
- [x] **2.4** IMPLEMENT the **extension point** (F-3 / AC-F3-2 / TC-QGATES-008):
  the same env/declaration seam lets a project add or override a gate **without
  editing the script's core** (e.g. an env var or a fixture/declaration file
  naming additional gates, merged per documented precedence). Project override
  of a built-in name takes effect per the documented precedence rule. *(owner: @coder; F-3, AC-F3-2; TC-QGATES-008)*
- [x] **2.5** VERIFY locally: `scripts/quality-gates.sh` (no args)
  runs the default set and exits 0 (this is the Phase-2 behavioral pre-check;
  the full clean-tree case is dogfooded in Phase 8 / TC-QGATES-002). Confirm the
  dispatch invokes — does not reimplement — the 4 real gates (grep the registry).
  *(owner: @coder; AC-F1-2, AC-F1-3; TC-QGATES-003)*
- [x] **2.6** HAND to `@committer`: stage `scripts/quality-gates.sh` only.

**Acceptance Criteria**:

- Must: AC-F1-2 (clean tree, no args → exit 0, runs the default set),
  AC-F1-3 (default set **invokes** the 4 real gates — not reimplements),
  AC-F3-1 (AGENTS.md declaration honored preferred; else documented default),
  AC-F3-2 (extension point — project gate takes effect without a core edit).
- Should: stable gate ordering (NFR-1 precondition).

**Files and modules**:

- `scripts/quality-gates.sh` (updated — dispatch loop + default-set registry + resolution + extension seam)

**System docs to update**:

- none

**Tests**:

- `bash -n scripts/quality-gates.sh`; clean-tree run exits 0.
- Behavioral resolution/extension cases built in Phase 5 (TC-QGATES-002/003/007/008).

**Completion signal**: `feat(GH-37): implement gate dispatch + built-in default set (invoke, don't reimplement)`

---

### Phase 3: AI-actionable output contract + canonical log dir

**Goal**: Emit the structured, AI-actionable per-gate summary (stable name,
status, duration; on failure log pointer + bounded excerpt) using stable
machine-parseable prefixes/tags, write per-gate logs to the canonical output
dir `tmp/quality-gates/<YYYY-MM-DD>/` (OQ-2), and split summary (stdout) from
diagnostics (stderr).

**Tasks**:

- [x] **3.1** IMPLEMENT the per-gate report record (F-2 / DM-1 / NFR-5): each
  gate entry in the summary carries a **stable name**, a **pass/fail status**,
  and a **duration**; on failure it additionally carries a **log pointer** to
  the canonical output dir and a **short bounded excerpt** (bounded line count —
  never dump the entire log). *(owner: @coder; F-2, AC-F2-1, AC-F2-2, NFR-5; TC-QGATES-002, TC-QGATES-004)*
- [x] **3.2** CHOOSE and PIN a stable per-gate field syntax (resolves OQ-T1) —
  e.g. a tagged line `(quality-gates) name=<…> status=<PASS|FAIL> duration=<…>`
  with a failure block carrying `log=<…>` + a bounded excerpt. The exact form is
  the author's choice but MUST be stable, documented in the guide (Phase 6 /
  TC-QGATES-012), and asserted identically in the suite (Phase 5 /
  TC-QGATES-002/004). *(owner: @coder; F-2, OQ-T1; TC-QGATES-002, TC-QGATES-004, TC-QGATES-012)*
- [x] **3.3** IMPLEMENT stable machine-parseable prefixes/tags (bash.md §5
  `LOG_TAG` convention) so a downstream agent (`@runner`/`@fixer`) can parse
  which gates failed and where to look without scraping free-form prose. Summary
  → **stdout**; errors/diagnostics → **stderr**. *(owner: @coder; F-2, NFR-5; TC-QGATES-002, TC-QGATES-004)*
- [x] **3.4** IMPLEMENT the canonical output dir (OQ-2): the runner writes
  structured per-gate output under `tmp/quality-gates/<YYYY-MM-DD>/` (date in
  UTC `+%F`). The runner does **not** itself mirror to `tmp/run-logs-runner/` —
  `@runner` (via `/check`) mirrors command output there as for any command; this
  is documented in the guide (Phase 6) and the `/check` contract, not coded here.
  *(owner: @coder; F-2, OQ-2; TC-QGATES-004 steps 6–7, TC-QGATES-013)*
- [x] **3.5** VERIFY locally:
  (Phase 2.4) and confirm the summary emits the FAIL entry with a log pointer to
  `tmp/quality-gates/<date>/` + a bounded excerpt, and that the pointed-to log
  file exists and contains the gate's output; confirm a clean run emits all-PASS
  entries. *(owner: @coder; AC-F2-1, AC-F2-2, OQ-2; TC-QGATES-004 [behavioral pre-check])*
- [x] **3.6** HAND to `@committer`: stage `scripts/quality-gates.sh` only.

**Acceptance Criteria**:

- Must: AC-F2-1 (every gate entry: stable name + status + duration),
  AC-F2-2 (failing gate: log pointer + bounded excerpt + stable prefixes).
- Should: stdout/stderr cleanly separated.

**Files and modules**:

- `scripts/quality-gates.sh` (updated — report shape + canonical log dir + prefix discipline)

**System docs to update**:

- none

**Tests**:

- `bash -n`; injected-failing-gate + clean-run manual smoke.
- Field-shape + prefix + canonical-dir assertions built in Phase 5 (TC-QGATES-002/004).

**Completion signal**: `feat(GH-37): add AI-actionable per-gate output + canonical log dir`

---

### Phase 4: Argument contract + discovery tolerance + taxonomy docs

**Goal**: Implement the honest arg contract (OQ-1 / DEC-4): `all` (default) +
named-gate selection now; `fast`/`slow` tolerated-but-documented-as-future;
unknown selectors warned/ignored, **never** a hard crash that masks a real
failure. Finalize `--help` with the implemented-vs-future taxonomy.

**Tasks**:

- [x] **4.1** IMPLEMENT arg handling (F-4 / OQ-1 / DEC-4 / RSK-2):
  - **no args ⇒ run all gates** (default = `all`) — AC-F4-1;
  - **one or more named gates ⇒ run only those** (named-gate subset) — AC-F4-2;
  - **unknown selectors tolerated**: warned/ignored per documented semantics
    (a notice naming the unknown selector on stderr/stdout), **never** a hard
    crash that masks a real result — AC-F4-2 / RSK-2;
  - **`fast`/`slow`** accepted but treated per the honest minimum (documented as
    future — not a behavioral partition now) — OQ-1 / DEC-4;
  - always operate from **repo root** (`/check` §`<resolution>` step 4).
  *(owner: @coder; F-4, AC-F4-1, AC-F4-2, OQ-1, DEC-4, RSK-2; TC-QGATES-005)*
- [x] **4.2** IMPLEMENT the **non-masking** safety half (AC-F4-2 / RSK-4): an
  unknown selector alongside a known gate must not convert a real gate failure
  into exit 0 — tolerance is warned/ignored, but a failing gate still drives a
  non-zero overall exit. *(owner: @coder; F-4, AC-F4-2, RSK-4; TC-QGATES-005 step 6)*
- [x] **4.3** FINALIZE `--help`/usage (AC-F4-3 / TC-QGATES-006) documenting the
  `[fast|slow|all|<gate>...]` taxonomy honestly — implemented selectors (`all`
  default + named-gate) vs **future** (`fast`/`slow`, marked future/deferred in
  the same help block) — plus exit-code semantics. *(owner: @coder; F-4, AC-F4-3, OQ-1; TC-QGATES-006)*
- [x] **4.4** VERIFY locally:
  unknown-selector tolerance emits a notice and does not crash; a failing
  named gate + an unknown selector still exits non-zero. *(owner: @coder; AC-F4-1, AC-F4-2; TC-QGATES-005, TC-QGATES-006 [behavioral pre-checks])*
- [x] **4.5** HAND to `@committer`: stage `scripts/quality-gates.sh` only.
  *(owner: @committer)*

**Acceptance Criteria**:

- Must: AC-F4-1 (no args ⇒ all), AC-F4-2 (named subset + tolerant non-masking),
  AC-F4-3 (`--help` documents taxonomy + implemented-vs-future + exit codes).
- Should: tolerance notice references the unknown selector by name.

**Files and modules**:

- `scripts/quality-gates.sh` (updated — arg parsing + tolerance + finalized `--help`)

**System docs to update**:

- none

**Tests**:

- `bash -n`; arg-handling smoke.
- Full arg/tolerance/help cases built in Phase 5 (TC-QGATES-005/006).

**Completion signal**: `feat(GH-37): add arg contract (all default + named-gate; fast/slow documented future)`

---

### Phase 5: Contract test suite (incl. the regression-guard negative case)

**Goal**: Create `scripts/.tests/test-quality-gates.sh` — the bash contract suite
proving resolution, per-gate reporting, exit codes, AI-actionable output, arg
handling, determinism, performance, stdlib-only, **and** the regression-guard
negative case (AC-F1-4 — the single most important assertion). Hermetic;
auto-discovered by `scripts/test-all.sh` + CI `bash-tests`.

**Tasks**:

- [x] **5.1** CREATE `scripts/.tests/test-quality-gates.sh` (new, executable)
  following the `test-*.sh` convention + the embedded framework (bash.md §11):
  strict mode + traps; a pass/fail summary; `mktemp -d` working area removed in
  an EXIT trap (no state leakage). *(owner: @coder; F-5, AC-F5-1, NFR-6; TC-QGATES-009)* — done: suite created, executable, embedded framework, EXIT trap teardown.
- [x] **5.2** TC-QGATES-001 (static): assert `scripts/quality-gates.sh` exists +
  executable; shebang + strict mode + testable main guard + stable `LOG_TAG`;
  descriptive comment header present; **no** hand-added license/copyright block
  (OQ-3 / RSK-8). *(owner: @coder; F-1, AC-F1-1, NFR-6, RSK-8; TC-QGATES-001)* — PASS.
- [x] **5.3** TC-QGATES-002 (behavior): on a clean tree (or a fixture PASS-gate
  set per OQ-T3), no args ⇒ exit 0, every default gate reported PASS with stable
  name/status/duration; no FAIL entries; default = `all`. *(owner: @coder; F-1, F-2, F-4, AC-F1-2, AC-F2-1, AC-F4-1, DM-1, DM-3, NFR-3, NFR-5; TC-QGATES-002)* — PASS (fixture gates per OQ-T3).
- [x] **5.4** TC-QGATES-003 (static + behavior): the default-set registry
  **invokes** (not reimplements) the 4 real gates — grep the 4 identifiers
  (`test-all.sh`, `test-doc-distribution.sh`, `build-claude-plugin.sh`,
  `git diff --check`); assert no rediscovery logic in the orchestrator; spot-run
  one named real gate and assert it appears in the summary. *(owner: @coder; F-1, F-3, AC-F1-3, NG-1, RSK-1, RSK-9; TC-QGATES-003)* — PASS.
- [x] **5.5** TC-QGATES-004 — **REGRESSION GUARD (AC-F1-4 / RSK-4 — most important)**:
  inject a deliberately failing fixture gate (a temp script printing a
  recognizable failure marker + `exit 7`) via the extension seam; assert the
  runner exits **non-zero**, reports that gate as **FAIL** with a stable
  prefix/tag, emits a log pointer to `tmp/quality-gates/<YYYY-MM-DD>/` whose
  pointed-to file exists and contains the gate's output, includes a **bounded**
  excerpt, and leaves the real repo tree untouched (`git status --porcelain`
  unchanged). *(owner: @coder; F-1, F-2, AC-F1-4, AC-F2-2, DM-1, DM-3, NFR-3, NFR-5, RSK-4, OQ-2; TC-QGATES-004)* — PASS (FAIL reported, exit≠0, log+excerpt+marker, git status unchanged).
- [x] **5.6** TC-QGATES-005 (behavior — arg handling + non-masking): named-gate
  subset runs only the named gate; unknown selectors tolerated (notice emitted,
  no crash); tolerance is **non-masking** (a failing named gate + an unknown
  selector still exits non-zero). *(owner: @coder; F-4, AC-F4-2, DM-3, NFR-3, OQ-1, RSK-2; TC-QGATES-005)* — PASS.
- [x] **5.7** TC-QGATES-006 (behavior): `--help` exits 0 and documents the
  taxonomy (`all` + named-gate implemented; `fast`/`slow` future) + exit-code
  semantics. *(owner: @coder; F-4, AC-F4-3, OQ-1, DEC-4; TC-QGATES-006)* — PASS.
- [x] **5.8** TC-QGATES-007 (behavior — resolution): a fixture AGENTS.md-style
  declaration is honored (preferred); with no declaration, the documented
  built-in default set is used; precedence is unambiguous. *(owner: @coder; F-3, AC-F3-1, DM-2, DEC-3; TC-QGATES-007)* — PASS (unit via source + behavior via env seam).
- [x] **5.9** TC-QGATES-008 (behavior — extension): a project gate added via the
  extension seam runs per documented precedence **without editing** the script's
  core (`git diff --stat -- scripts/quality-gates.sh` empty for the addition);
  override precedence confirmed. *(owner: @coder; F-3, AC-F3-2; TC-QGATES-008)* — PASS (override verified via QGATES_OUTPUT_ROOT log file since PASS gates emit no excerpt).
- [x] **5.10** TC-QGATES-019 (behavior — determinism): two runs of the same state
  yield the identical pass/fail verdict + identical gate ordering (durations may
  vary — compare verdict + status + ordered gate-name list). *(owner: @coder; F-1, AC-NFR1-1, NFR-1, RSK-9; TC-QGATES-019)* — PASS.
- [x] **5.11** TC-QGATES-020 (performance): time a run over a fixture set of
  trivial PASS gates; assert orchestrator overhead (dispatch + reporting) < 2s
  wall-clock and each gate appears exactly once (no gratuitous re-runs).
  *(owner: @coder; F-1, AC-NFR2-1, NFR-2; TC-QGATES-020)* — PASS (10 trivial gates, no re-runs).
- [x] **5.12** TC-QGATES-021 (static + offline): the orchestrator's own code path
  introduces no non-stdlib runtime dependency (no `curl`/`wget`/`python`/`node`/
  `ruby` in its own logic; delegation to gates is allowed); the suite runs to
  green with no network access. *(owner: @coder; F-1, AC-NFR4-1, NFR-4; TC-QGATES-021)* — PASS.
- [x] **5.13** VERIFY the suite passes: `bash scripts/.tests/test-quality-gates.sh`
  → exit 0 with a PASS summary. *(owner: @coder; F-5, AC-F5-1; TC-QGATES-009)* — PASS: 12/12 passed, exit 0.
- [x] **5.14** HAND to `@committer`: stage `scripts/.tests/test-quality-gates.sh`
  only. *(owner: @committer)* — staged test suite + plan update; commit pending.

**Acceptance Criteria**:

- Must: AC-F5-1 (suite exists, executable, convention-following, proves the
  contract incl. regression-guard), AC-F1-4 (regression guard — failing gate
  reported + non-zero exit), AC-NFR1-1 (determinism), AC-NFR2-1 (overhead < 2s),
  AC-NFR4-1 (stdlib-only + offline).
- Should: every hermetic case asserts `git status --porcelain` unchanged after
  the run (RSK-T3).

**Files and modules**:

- `scripts/.tests/test-quality-gates.sh` (new — the contract suite)

**System docs to update**:

- none

**Tests**:

- `bash scripts/.tests/test-quality-gates.sh` (the suite itself).
- Auto-discovery by `scripts/test-all.sh` + CI `bash-tests` asserted in Phase 8
  (TC-QGATES-010).

**Completion signal**: `test(GH-37): add quality-gates contract suite (incl. regression guard)`

---

### Phase 6: Operator guide + AGENTS.md resolution wiring

**Goal**: Author the redistributable operator guide (F-6) and wire the minimal
honest `AGENTS.md` declaration (F-7 / DEC-3) so `/check` → `@runner` →
`scripts/quality-gates.sh` resolves deterministically. Apply the guide's license
header via the script (no hand-added headers).

**Tasks**:

- [x] **6.1** CREATE `doc/guides/quality-gates.md` (new) with frontmatter
  declaring `ados_distribution: redistributable` (NFR-8 / DEC-5 — the guide is
  generic/reusable, so `redistributable` is honest). Author it **without** the
  copyright/MIT/source header lines (Phase 6.3 applies them via the script).
  *(owner: @coder; F-6, AC-F6-1, NFR-8, RSK-5; TC-QGATES-011)* — done; frontmatter has ados_distribution at line 5.
- [ ] **6.2** AUTHOR the guide content (F-6 / AC-F6-2 / TC-QGATES-012) covering:
  - **how to run gates** — directly (`scripts/quality-gates.sh`) and via `/check`
    (the resolution contract);
  - **declaring the gate set / runner in `AGENTS.md`** (DM-2 / the resolution
    contract step 1);
  - **adding a project-specific gate** via the extension point (no core edit);
  - the **AI-tuned output contract** — fields (name/status/duration/[on fail] log
    pointer + excerpt), stable prefixes/tags, the exact field syntax pinned in
    Phase 3.2 (OQ-T1);
  - **exit-code semantics** (0 iff all pass; non-zero iff ≥1 fails; no third
    state);
  - **log locations** — canonical `tmp/quality-gates/<YYYY-MM-DD>/` (OQ-2) + the
    `@runner` mirror under `tmp/run-logs-runner/<YYYY-MM-DD>/`;
  - **cross-links (not duplicates)** to `doc/spec/features/feature-quality-gates-and-pr.md`,
    `.ai/rules/bash.md`, and `doc/guides/change-lifecycle.md` (phase 9).
  *(owner: @coder; F-6, AC-F6-2, OQ-2; TC-QGATES-012)* — done; all sections authored (running/declaring/extending/output/exit-codes/logs/cross-links).
- [ ] **6.3** RUN `scripts/add-header-location.sh doc/guides` (a default header
  path) so the script injects the canonical copyright/MIT/source header into the
  new guide's frontmatter (AGENTS.md: the AI must **not** hand-add headers).
  Verify idempotency: re-running produces no diff. *(owner: @coder; NG-7, RSK-8; TC-QGATES-011)* — done; updated 1, then 0 on re-run (idempotent).
- [ ] **6.4** EDIT `AGENTS.md` (F-7 / DEC-3 / AC-F7-2 / TC-QGATES-014): add the
  **minimal honest declaration** naming the runner (`scripts/quality-gates.sh`)
  and (if enumerated) only **real** gates — no invented gates. Place it under a
  sensible existing section (e.g., a short note near "## Running tests" or
  "## Running the system") so `/check` §`<resolution>` step 1 succeeds
  deterministically rather than relying on the missing-file fallback. Keep it
  truthful and minimal (DEC-3). *(owner: @coder; F-7, AC-F7-2, DM-2, DEC-3; TC-QGATES-014)* — done; "## Quality gates" section added after "## Running tests" with `./scripts/quality-gates.sh` declaration.
- [ ] **6.5** VERIFY: `rg -n '^ados_distribution: redistributable' doc/guides/quality-gates.md`
  → exactly 1 match in the opening frontmatter block; `rg -n 'scripts/quality-gates\.sh' AGENTS.md`
  → ≥1 match naming the real script; the guide's header is present exactly once
  and re-running `add-header-location.sh` is a no-op. *(owner: @coder; AC-F6-1, AC-F7-2; TC-QGATES-011, TC-QGATES-014)* — PASS: marker at line 5, AGENTS.md match at line 220, header idempotent.
- [x] **6.6** HAND to `@committer`: stage `doc/guides/quality-gates.md` and
  `AGENTS.md` (and only those — AGENTS.md is edited here, not `.opencode/`).
  *(owner: @committer)* — staged + commit pending.

**Acceptance Criteria**:

- Must: AC-F6-1 (guide exists + `ados_distribution: redistributable`),
  AC-F6-2 (guide documents running/declaring/extending/output/exit-codes/
  log-locations + cross-links), AC-F7-2 (`AGENTS.md` carries the minimal honest
  declaration naming the real runner/gate set).
- Should: header applied via the script only (idempotent); declaration minimal.

**Files and modules**:

- `doc/guides/quality-gates.md` (new — operator guide)
- `AGENTS.md` (updated — minimal honest resolution declaration)

**System docs to update**:

- `doc/guides/quality-gates.md` (new guide)

**Tests**:

- `rg` assertions on the guide marker + the AGENTS.md declaration; `add-header-location.sh`
  idempotency; `bash scripts/.tests/test-doc-distribution.sh` stays green (Phase 8 /
  TC-QGATES-016).

**Completion signal**: `docs(GH-37): add operator guide + wire AGENTS.md resolution declaration`

---

### Phase 7: Feature-spec reconciliation + plugin-freshness invariant

**Goal**: Surgically reconcile `doc/spec/features/feature-quality-gates-and-pr.md`
(F-8 / DEC-6) so its dangling reference is a real component, and verify the
`.ados-claude/` 1:1 freshness invariant — expected **no** `.opencode/` change
(NG-5), so `.ados-claude/` MUST remain untouched.

**Tasks**:

- [ ] **7.1** EDIT `doc/spec/features/feature-quality-gates-and-pr.md` **surgically**
  (F-8 / DEC-6 / TC-QGATES-015) — only these three changes, no unrelated prose:
  - **Core Components table**: add a row for `scripts/quality-gates.sh` (the
    AI-tuned quality-gates runner/orchestrator);
  - **NFR-1** ("deterministic resolution"): reconcile the wording so it reflects
    the now-real runner + the `AGENTS.md` declaration (no longer asserts a
    missing file as the contract);
  - **Testing Approach** (Quality Assurance Strategy): move off "Manual"-only —
    reference the automated suite (`scripts/.tests/test-quality-gates.sh`) +
    the runner as a gate.
  *(owner: @coder; F-8, AC-F8-1, DEC-6; TC-QGATES-015)*
- [ ] **7.2** VERIFY the reconciliation is surgical: `git diff --stat -- doc/spec/features/feature-quality-gates-and-pr.md`
  is small/scoped; manual review confirms only component-table/NFR-1/Testing-
  Approach changes (no capability-semantics change, no unrelated churn).
  *(owner: @coder; AC-F8-1, DEC-6; TC-QGATES-015 step 4)*
- [ ] **7.3** PLUGIN-FRESHNESS INVARIANT (AC-F8-3 / RSK-7 / TC-QGATES-017):
  determine the `.opencode/` edit surface for this change
  (`git diff --name-only <merge-base> HEAD -- .opencode/` — **expected: empty**
  per NG-5: no agent/command source edited). Then run
  `scripts/build-claude-plugin.sh` and assert `git diff --stat -- .ados-claude/`
  is **EMPTY** (the "no `.opencode/` edit ⇒ `.ados-claude/` untouched" branch —
  needless regeneration is a violation). If a `.opencode/` source *did* change,
  `.ados-claude/` MUST instead list exactly the generated counterparts of the
  edited sources. *(owner: @coder; F-8, AC-F8-3, RSK-7; TC-QGATES-017)*
- [ ] **7.4** HAND to `@committer`: stage `doc/spec/features/feature-quality-gates-and-pr.md`
  only (do **not** stage `.ados-claude/` — it must be untouched). *(owner: @committer)*

**Acceptance Criteria**:

- Must: AC-F8-1 (feature spec reconciled surgically — component table + NFR-1 +
  Testing Approach; no unrelated edits), AC-F8-3 (`.ados-claude/` regenerated iff
  `.opencode/` changed — expected untouched).
- Should: the reconciliation cites `scripts/quality-gates.sh` and the automated
  suite by name.

**Files and modules**:

- `doc/spec/features/feature-quality-gates-and-pr.md` (updated — surgical reconciliation)

**System docs to update**:

- `doc/spec/features/feature-quality-gates-and-pr.md` (the spec being made real)

**Tests**:

- `rg` on the reconciled spec (component-table / NFR-1 / Testing-Approach
  context); `git diff --stat` scoped-review.
- `scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/` succeeds
  (freshness; full re-run in Phase 8 / TC-QGATES-018).

**Completion signal**: `docs(GH-37): reconcile feature spec + verify plugin freshness invariant`

---

### Phase 8: Quality gates / verification + dogfood + finalize

**Goal**: Prove the change is green end-to-end: the new suite passes, the
aggregator auto-discovers it, the drift guard stays green, plugin freshness +
shellcheck stay clean (CI authoritative), `git diff --check` is clean, and —
**the dogfood** — `scripts/quality-gates.sh` runs itself end-to-end on the clean
tree and exits 0. Confirm version/plugin posture + Definition of Done. This
phase produces **no commit** unless a regression is found (then a targeted
`fix`/`test` commit via `@committer`).

**Tasks**:

- [ ] **8.1** RUN `bash scripts/.tests/test-quality-gates.sh` — MUST pass (the new
  contract suite: resolution, per-gate reporting, exit codes, AI-actionable
  output, arg handling, determinism, perf, stdlib-only, **and** the
  regression-guard negative case AC-F1-4). *(owner: @coder; F-5, AC-F5-1, AC-F1-4; TC-QGATES-004, TC-QGATES-009)*
- [ ] **8.2** RUN `bash scripts/test-all.sh` — MUST pass, including the new suite
  auto-discovered (NFR-7 / TC-QGATES-010), and all existing `scripts/.tests/` +
  CI-safe `tools/.tests/` suites stay green. *(owner: @coder; F-5, AC-F5-2, NFR-7; TC-QGATES-010)*
- [ ] **8.3** RUN `bash scripts/.tests/test-doc-distribution.sh` — MUST stay green
  (the new guide carries `ados_distribution: redistributable`; no marker/drift).
  *(owner: @coder; F-8, AC-F8-2, NFR-8, RSK-5; TC-QGATES-016)*
- [ ] **8.4** RUN the plugin-freshness gate (AC-F8-4 / TC-QGATES-018):
  `scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/` succeeds
  (generated plugin is current; `.ados-claude/` untouched). Then run
  **shellcheck** at `error` severity **if present**:
  `if command -v shellcheck >/dev/null 2>&1; then shellcheck -S error scripts/quality-gates.sh scripts/.tests/test-quality-gates.sh; else echo 'shellcheck not installed locally — CI authoritative'; fi`.
  Do **not** block on a missing local `shellcheck` (CI is authoritative).
  *(owner: @coder; F-8, AC-F8-4, NFR-6, RSK-7; TC-QGATES-018)*
- [ ] **8.5** RUN `git diff --check` — MUST be clean (no whitespace/conflict-marker
  violations across the diff). *(owner: @coder; TC-QGATES-016, TC-QGATES-018 static guard)*
- [ ] **8.6** RUN `bash -n scripts/quality-gates.sh scripts/.tests/test-quality-gates.sh`
  (local syntax gate — the lint-available-locally check per the env constraint).
  *(owner: @coder; NFR-6)*
- [ ] **8.7** DOGFOOD — TC-QGATES-013 / AC-F7-1 / AC-F1-2: with the repo tree
  clean, run `scripts/quality-gates.sh` itself end-to-end (the runner runs itself
  as a gate once the new suite exists). Assert exit 0, a structured all-PASS
  summary on stdout, and that logs land at the canonical
  `tmp/quality-gates/<YYYY-MM-DD>/`. This is the G-1/NFR-1 outcome made concrete:
  `/check` → `@runner` → `scripts/quality-gates.sh` resolves and runs the real
  runner on a clean tree. *(owner: @coder; F-1, F-7, AC-F1-2, AC-F7-1, NFR-1, DM-2, RSK-3; TC-QGATES-013)*
- [ ] **8.8** SPEC RECONCILIATION confirmation: `doc/spec/` reflects the new truth
  — the runner is a real component (Phase 7), the AGENTS.md declaration makes
  resolution deterministic (Phase 6), the guide documents the contract (Phase 6).
  No separate `@doc-syncer` run is owed for this change's own deliverables beyond
  the Phase-7 surgical edit. *(owner: @coder; F-8, AC-F8-1)*
- [ ] **8.9** VERSION IMPACT per repo conventions: this repo has **no** application
  SemVer file (no `package.json`/`VERSION`/`CHANGELOG` at repo root); the plugin
  manifest version (`.ados-claude/.claude-plugin/plugin.json`, static `1.0.0`
  hard-set in `scripts/build-claude-plugin.sh`) is intentionally **NOT** bumped
  for a scaffolding+docs change (the manifest version is a plugin-marketplace
  version, not a per-change semver, and the build script's static-version design
  governs it). Record the no-bump decision; confirm no version artifact to update.
  *(owner: @coder)*
- [ ] **8.10** DOD CHECK: all plan tasks checked; all spec ACs (§17 groups A–I,
  24 ACs) satisfied; the open questions (OQ-T1, OQ-T3) are delivery-time
  resolutions, not blockers. *(owner: @coder)*
- [ ] **8.11** HAND OFF: the change is ready for `@reviewer` (review_fix,
  lifecycle phase 8), `@runner` (quality_gates — already exercised in 8.7),
  `@pm` (dod_check, phase 10), and `@pr-manager` (pr_creation, phase 11). This
  plan performs NO commit; staging/committing across all phases is performed by
  `@committer`. This plan body contains **no review phase** (review is a separate
  lifecycle phase owned by `@reviewer`). *(owner: @coder)*

**Acceptance Criteria**:

- Must: AC-F5-2 (suite auto-discovered by `test-all.sh` + CI), AC-F8-2 (drift
  guard green), AC-F8-4 (plugin freshness + shellcheck green), AC-F7-1
  (end-to-end resolution runs the real runner on a clean tree, exits 0, logs at
  the canonical dir), AC-F1-2 (clean tree, no args → exit 0).
- Should: all listed script tests pass; `git diff --check` clean; no local
  `shellcheck` does not block (CI authoritative).

**Files and modules**:

- none committed by default (verification phase). A regression fix, if needed,
  gets its own targeted commit with explicit-path staging.

**System docs to update**:

- none beyond Phases 6–7 (reconciliation + declaration + guide already landed)

**Tests**:

- The Phase-8 runs are the verification. Re-run the Phase-8 suite as the final
  green baseline.

**Completion signal**: No commit (green baseline). Downstream: `@reviewer`
(review_fix) → `@runner` (quality_gates) → `@pm` (dod_check) → `@pr-manager`
(pr_creation). End of plan body — hand to review/quality gates.

---

## Test Scenarios

> Maps the 21 test-plan cases (TC-QGATES-001..021) to phases and acceptance
> criteria. Full case detail lives in `./chg-GH-37-test-plan.md`.

| ID | Scenario | Phases | AC |
|----|----------|:------:|----|
| TS-1 | Runner exists, executable, bash.md-conformant (descriptive header, no license block) | 1, 5 | AC-F1-1 |
| TS-2 | Clean tree, no args → exit 0, all gates PASS, structured per-gate output; default = `all` | 2, 3, 5, 8 | AC-F1-2, AC-F2-1, AC-F4-1 |
| TS-3 | Built-in default set invokes (not reimplements) the 4 real gates | 2, 5 | AC-F1-3 |
| TS-4 | Regression guard: injected failing gate → reported (log pointer + excerpt + stable prefixes) + non-zero exit | 3, 5 | AC-F1-4, AC-F2-2 |
| TS-5 | Named-gate selection runs only those; unknown selectors tolerated (non-masking) | 4, 5 | AC-F4-2 |
| TS-6 | `--help` documents the `[fast|slow|all|<gate>...]` taxonomy (implemented vs future) + exit codes | 4, 5 | AC-F4-3 |
| TS-7 | AGENTS.md declaration honored (preferred); else documented built-in default | 2, 5 | AC-F3-1 |
| TS-8 | Extension point: project gate takes effect without editing the script core | 2, 5 | AC-F3-2 |
| TS-9 | Contract suite exists, executable, follows `test-*.sh` convention, proves the contract incl. regression guard | 5 | AC-F5-1 |
| TS-10 | Suite auto-discovered by `test-all.sh` + CI `bash-tests` (no manual wiring) | 5, 8 | AC-F5-2 |
| TS-11 | Operator guide exists + declares `ados_distribution: redistributable` | 6 | AC-F6-1 |
| TS-12 | Guide documents running/declaring/extending/output/exit-codes/log-locations + cross-links | 6 | AC-F6-2 |
| TS-13 | `/check` → `@runner` → `scripts/quality-gates.sh` end-to-end on clean tree (resolves, runs, logs, summary) | 8 | AC-F7-1 |
| TS-14 | `AGENTS.md` carries minimal honest declaration (real runner/gate set; no invented gates) | 6 | AC-F7-2 |
| TS-15 | `feature-quality-gates-and-pr.md` reconciled surgically (component table, NFR-1, Testing Approach) | 7 | AC-F8-1 |
| TS-16 | GH-67 doc-distribution drift guard stays green (new guide carries marker) | 8 | AC-F8-2 |
| TS-17 | `.ados-claude/` freshness invariant (regenerated iff `.opencode/` changed; expected untouched) | 7, 8 | AC-F8-3 |
| TS-18 | Plugin-freshness check + shellcheck (`error`) stay green (CI authoritative) | 7, 8 | AC-F8-4 |
| TS-19 | Determinism: run twice → same verdict + identical gate ordering | 5 | AC-NFR1-1 |
| TS-20 | Performance: orchestrator overhead (dispatch + reporting) < 2s; no gratuitous re-runs | 5 | AC-NFR2-1 |
| TS-21 | Stdlib-only: orchestrator depends only on Bash 4.0+ stdlib; suite needs no network | 5 | AC-NFR4-1 |

---

## AC Coverage Map

> 24 / 24 spec ACs (§17 groups A–I) covered by ≥1 phase task.

| AC | Phase(s) | TC(s) | Status |
|----|:--------:|:------|--------|
| AC-F1-1 (runner exists + executable + bash.md-conformant + descriptive header) | 1, 5 | TC-QGATES-001 | Pending |
| AC-F1-2 (clean tree, no args → exit 0, all PASS, AI-actionable output) | 2, 3, 5, 8 | TC-QGATES-002 | Pending |
| AC-F1-3 (default set invokes — not reimplements — the 4 real gates) | 2, 5 | TC-QGATES-003 | Pending |
| AC-F1-4 (deliberately failing gate → reported FAIL + non-zero exit) | 3, 5 | TC-QGATES-004 | Pending |
| AC-F2-1 (each gate entry: stable name + status + duration) | 3, 5 | TC-QGATES-002 | Pending |
| AC-F2-2 (failing gate: log pointer + bounded excerpt + stable prefixes) | 3, 5 | TC-QGATES-004 | Pending |
| AC-F3-1 (AGENTS.md declaration honored preferred; else documented default) | 2, 5 | TC-QGATES-007 | Pending |
| AC-F3-2 (extension point: project gate takes effect without a core edit) | 2, 5 | TC-QGATES-008 | Pending |
| AC-F4-1 (no args ⇒ runs all; default = `all`) | 2, 4, 5 | TC-QGATES-002, TC-QGATES-005 | Pending |
| AC-F4-2 (named gates run only those; unknown selectors tolerated non-masking) | 4, 5 | TC-QGATES-005 | Pending |
| AC-F4-3 (`--help` documents taxonomy implemented-vs-future + exit codes) | 4, 5 | TC-QGATES-006 | Pending |
| AC-F5-1 (suite exists, executable, convention-following, proves contract incl. regression guard) | 5 | TC-QGATES-009 | Pending |
| AC-F5-2 (suite auto-discovered by `test-all.sh` + CI `bash-tests`) | 5, 8 | TC-QGATES-010 | Pending |
| AC-F6-1 (guide exists + `ados_distribution: redistributable`) | 6 | TC-QGATES-011 | Pending |
| AC-F6-2 (guide documents running/declaring/extending/output/exit-codes/log-locations) | 6 | TC-QGATES-012 | Pending |
| AC-F7-1 (`/check`→`@runner`→script end-to-end on clean tree; resolves, runs, logs, summary) | 8 | TC-QGATES-013 | Pending |
| AC-F7-2 (AGENTS.md carries minimal honest declaration) | 6 | TC-QGATES-014 | Pending |
| AC-F8-1 (feature spec reconciled surgically) | 7, 8 | TC-QGATES-015 | Pending |
| AC-F8-2 (drift guard stays green) | 8 | TC-QGATES-016 | Pending |
| AC-F8-3 (`.ados-claude/` regenerated iff `.opencode/` changed) | 7, 8 | TC-QGATES-017 | Pending |
| AC-F8-4 (plugin-freshness + shellcheck stay green) | 7, 8 | TC-QGATES-018 | Pending |
| AC-NFR1-1 (determinism: same verdict + gate order across runs) | 5 | TC-QGATES-019 | Pending |
| AC-NFR2-1 (overhead < 2s; no gratuitous re-runs) | 5 | TC-QGATES-020 | Pending |
| AC-NFR4-1 (orchestrator stdlib-only; suite needs no network) | 5 | TC-QGATES-021 | Pending |

**Coverage: 24 / 24 ACs fully covered.**

---

## TC Traceability Map

> 21 / 21 test-plan cases covered by ≥1 phase task.

| TC | Phase task(s) |
|----|---------------|
| TC-QGATES-001 | 1.2, 5.2 |
| TC-QGATES-002 | 2.5, 3.5, 5.3, 8.7 |
| TC-QGATES-003 | 2.2, 2.5, 5.4 |
| TC-QGATES-004 | 3.5, 5.5 |
| TC-QGATES-005 | 4.4, 5.6 |
| TC-QGATES-006 | 4.4, 5.7 |
| TC-QGATES-007 | 2.3, 5.8 |
| TC-QGATES-008 | 2.4, 5.9 |
| TC-QGATES-009 | 5.1, 5.13 |
| TC-QGATES-010 | 5.13, 8.2 |
| TC-QGATES-011 | 6.1, 6.5 |
| TC-QGATES-012 | 6.2 |
| TC-QGATES-013 | 8.7 |
| TC-QGATES-014 | 6.4, 6.5 |
| TC-QGATES-015 | 7.1, 7.2 |
| TC-QGATES-016 | 8.3 |
| TC-QGATES-017 | 7.3 |
| TC-QGATES-018 | 8.4 |
| TC-QGATES-019 | 5.10 |
| TC-QGATES-020 | 5.11 |
| TC-QGATES-021 | 5.12 |

**Coverage: 21 / 21 TCs fully covered.**

---

## Minimum Quality Gates Before Completion

The change is **not done** until all of the following are green (per the
test-plan's "Minimum Quality Gates" + this plan):

- [ ] `bash scripts/.tests/test-quality-gates.sh` passes (the new contract suite
  incl. the regression-guard negative case AC-F1-4 / TC-QGATES-004).
- [ ] `bash scripts/test-all.sh` passes (the new suite auto-discovered; all
  existing `scripts/.tests/` + CI-safe `tools/.tests/` stay green) — TC-QGATES-010.
- [ ] `bash scripts/.tests/test-doc-distribution.sh` exits 0 (GH-67 drift guard
  green; new guide carries `redistributable`) — TC-QGATES-016.
- [ ] `scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/`
  succeeds (plugin freshness; regenerated iff `.opencode/` changed — expected
  untouched) — TC-QGATES-017/018.
- [ ] `shellcheck -S error scripts/quality-gates.sh scripts/.tests/test-quality-gates.sh`
  clean **if present locally**; CI authoritative (TC-QGATES-018). `bash -n` clean
  in all cases.
- [ ] Static/convention checks: runner exists + bash.md-conformant + descriptive
  header (no license block) (TC-QGATES-001); guide exists with `redistributable`
  (TC-QGATES-011); `AGENTS.md` declaration honest (TC-QGATES-014); feature spec
  reconciled surgically (TC-QGATES-015).
- [ ] `git diff --check` clean (no whitespace/conflict-marker violations).
- [ ] **Dogfood**: `scripts/quality-gates.sh` runs itself end-to-end on the clean
  tree → exit 0 (TC-QGATES-013).
- [ ] Traceability: every AC-F\*/AC-NFR\* in the spec is covered by ≥1 task
  (24/24 above); every TC-QGATES-\* by ≥1 task (21/21 above); no AC/TC without a
  case.

---

## Flagged Items

- **F-1 (Option A scope — DEC-1):** this change is scaffolding + docs only. The
  two owner-comment policies (hard-NFR enforcement; config-vs-code early gate)
  are **deferred** to a proposed companion ticket (NG-2 / spec §7.3). The plan
  does not implement either.
- **F-2 (Runner invokes, not reimplements — NG-1 / DEC-2 / RSK-1):** the default
  set references the real gate identifiers; the orchestrator does **not**
  rediscover tests. Enforced by AC-F1-3 / TC-QGATES-003 (grep the 4 identifiers +
  assert no `find … .tests` rediscovery logic).
- **F-3 (Regression guard — RSK-4, the most important case):** TC-QGATES-004
  (Phase 5.5) injects a failing fixture gate via the extension seam and asserts
  non-zero exit + FAIL report + log pointer + bounded excerpt. The runner must
  never produce a false-green.
- **F-4 (`.ados-claude/` 1:1 invariant — RSK-7):** expected **no** `.opencode/`
  change (NG-5) ⇒ `.ados-claude/` MUST remain untouched. Verified by the
  empty-diff branch in Phase 7.3 / TC-QGATES-017 and re-asserted as a gate in
  Phase 8.4 / TC-QGATES-018.
- **F-5 (Header convention — OQ-3 / DEC-5 / RSK-8):** `scripts/quality-gates.sh`
  uses a descriptive comment header (no license block); the new guide's header is
  applied via `scripts/add-header-location.sh doc/guides` (Phase 6.3). The AI
  never hand-adds headers (AGENTS.md rule).
- **F-6 (Version bump — N/A for this repo):** `version_impact: minor` is
  informational. No SemVer file at repo root; the plugin manifest version is
  static `1.0.0` and intentionally not bumped for a scaffolding+docs change
  (Phase 8.9, matching the GH-78 finalize precedent).
- **F-7 (Spec reconciliation — DEC-6):** the Phase-7 surgical edit to
  `feature-quality-gates-and-pr.md` (component table + NFR-1 + Testing Approach)
  is this change's system-spec reconciliation; no broader `@doc-syncer` run is
  owed for its own deliverables.
- **F-8 (Lint environment constraint):** `shellcheck`/`shfmt`/`actionlint` may
  not be installed locally; they run in CI. Local verification uses `bash -n` +
  the test suites (Phase 8.6). Do not block on a missing local `shellcheck`.

---

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-37-spec.md` | Spec (source of truth) |
| Implementation plan (this file) | `./chg-GH-37-plan.md` | Plan |
| Test plan | `./chg-GH-37-test-plan.md` | Test plan (21 TCs, 24 ACs traced) |
| PM notes | `./chg-GH-37-pm-notes.yaml` | PM state (PM-owned) |
| Quality-gates runner (new) | `scripts/quality-gates.sh` | Script (new) |
| Contract test suite (new) | `scripts/.tests/test-quality-gates.sh` | Test suite (new) |
| Operator guide (new) | `doc/guides/quality-gates.md` | Guide (new, `redistributable`) |
| AGENTS.md (edited) | `AGENTS.md` | Bootstrap doc (minimal honest declaration) |
| Feature spec (edited) | `doc/spec/features/feature-quality-gates-and-pr.md` | Feature spec (surgical reconciliation) |
| Resolution contract | `.opencode/command/check.md` §`<resolution>` | Command prompt (read-only — NG-5) |
| Bash conventions | `.ai/rules/bash.md` | Rule (runner + suite conformance) |
| Header script | `scripts/add-header-location.sh` | Script (applies guide header — `doc/guides` is a default path) |
| Plugin generator | `scripts/build-claude-plugin.sh` | Script (freshness gate; expected no-op here) |
| Test aggregator | `scripts/test-all.sh` | Script (auto-discovers the new suite) |
| Drift guard | `scripts/.tests/test-doc-distribution.sh` | Test (must stay green) |
| Related change | GH-78 (feature-spec coverage gate + debt) | Related |
| Related change | GH-67 (marker-driven doc distribution) | Related (governs the new guide's marker) |

**Files touched by delivery (summary):**

| Path | Phase | New/Updated |
|------|:-----:|:-----------:|
| `scripts/quality-gates.sh` | 1–4 | new |
| `scripts/.tests/test-quality-gates.sh` | 5 | new |
| `doc/guides/quality-gates.md` | 6 | new |
| `AGENTS.md` | 6 | updated (minimal honest declaration) |
| `doc/spec/features/feature-quality-gates-and-pr.md` | 7 | updated (surgical reconciliation) |
| `.ados-claude/` | — | **NOT regenerated (no `.opencode/` change — NG-5)** |

---

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-04 | plan-writer | Initial plan: 8 phases — (1) runner scaffolding/core; (2) gate dispatch + built-in default set + extension seam; (3) AI-actionable output + canonical log dir; (4) arg contract + tolerance + taxonomy docs; (5) contract test suite incl. regression guard; (6) operator guide + AGENTS.md wiring; (7) feature-spec reconciliation + plugin-freshness invariant; (8) quality gates/verification + dogfood + finalize. PM decisions OQ-1/OQ-2/OQ-3 + DEC-1..6 baked in. 24/24 ACs + 21/21 TCs covered (maps included). No review phase in body (review is lifecycle phase 8). |

---

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| _(populated during delivery by @coder / @reviewer / @runner)_ | | | | | |
