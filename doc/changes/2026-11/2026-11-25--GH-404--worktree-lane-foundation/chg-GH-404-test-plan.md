---
id: chg-GH-404-test-plan
status: Proposed
created: 2026-11-25
last_updated: 2026-11-25
owners: ["Juliusz Ćwiąkalski"]
service: "dispatch engine and lane lifecycle (git adapter worktree seam, worktree-scoped lane environment, host-index registration, closeout worktree removal)"
labels: [change, m4, worktree, dispatch, cli, config]
version_impact: minor
summary: "Test design for GH-404 worktree-lane-foundation: worktree-scoped lane lifecycle (create before the first phase, resume reuse, registration pinned to the main checkout, merge/closeout ordering), the disable-worktrees byte-for-byte regression, the clone-identity pin, the linked-only enumeration guard, and the DEC-8 pre-change-lane resume rule — all hermetic, fixture-driven, traceable to spec AC-F1-1..AC-F3-2."
links:
  change_spec: ./chg-GH-404-spec.md
  implementation_plan: ./chg-GH-404-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S36: A work item's whole lifecycle runs in its own worktree (default on) (M4)

## 1. Scope and Objectives

This plan protects the core behaviour of GH-404: a work item's whole lifecycle (`clarify_scope` → `pr_creation`) runs in its own linked worktree that `dispatch` creates before the first phase, while the main checkout stays on the base branch and clean; resume reuses the worktree; host-index registration stays pinned to the main checkout; merge and closeout complete a worktree-checked-out branch with logs swept before removal and removal strictly after merge confirmation; `dispatch status`, `lanes` and `board` show each lane's worktree path; and a disable-worktrees exception setting restores today's behaviour byte-for-byte.

The highest-integrity risks this plan is built against are: (1) the byte-for-byte guarantee of the exception mode (spec RSK-4, NFR-4, ticket AC7); (2) the host-index root-flip/prune regression that would silently lose `repos list` rows and degrade group-member resolution (RSK-2, NFR-6); (3) closeout ordering — removal before merge confirmation or logs destroyed by the sweep (RSK-3, NFR-5); (4) the positional first-block reliance in linked-worktree enumeration becoming load-bearing (RSK-5, NFR-8); (5) lane-environment derivation leaking state into the main checkout (RSK-1, NFR-2). Everything runs hermetically: temporary git repositories and temporary state stores created by the test harness, no live network, no live credentials.

### 1.1 In Scope

- Every acceptance criterion of the change spec §17: AC-F1-1, AC-F2-1, AC-F3-1, AC-F3-2, AC-F4-1, AC-F5-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-F9-1, AC-F10-1 — each with at least one named test.
- Spec decision DEC-8: a pre-change lane (lane record without worktree context) resumes exactly as today and never provisions a worktree — named test TC-RESUME-003.
- The governing ticket fixtures AC1–AC5 and the AC7 byte-identical regression, in fixture form.
- The `addWorktree` seam house-style contract: fixed argv, no shell, local only, no force flag, git refusal surfaced as a refusal — positive and negative matrices, with a canary/source-scan guard in the pattern of the existing no-shell dispatch check.
- Mutant/canary discipline where the corpus exists (closeout mutants): each named ordering rule is proven to fail when broken.
- Explicit statement of the fresh-worktree provisioning measurement (AC-F3-2, NFR-9) as delivery evidence — the plan demands the evidence be recorded, not a timing assertion.

### 1.2 Out of Scope & Known Gaps

- Parallel lanes, per-lane leases, second-lane admission, sync-before-PR, the "behind" indicator (GH-412) — no test here may assert multi-lane worktree behaviour.
- Repository lease semantics (one lane at a time, claimed before spawn) and the dispatch result `pr-open` semantics — unchanged behaviours protected by the existing dispatch harness-lease suite; this plan only pins them against accidental change via the exception-mode regression, it does not re-test them.
- Clone-identity/state-root derivation internals — pinned at the observable boundary (same identity, same state root), not re-derived.
- New telemetry — none exists in this change; nothing to test.
- Fresh-worktree provisioning **timing** — deliberately no automated assertion (see TC-ENV-004 and §8.3); the measurement is delivery evidence in the pm-notes.
- Live-tracker or live-PR behaviour — all merge/closeout scenarios use the hermetic production-composition pattern (temporary repository, squash landing, delivery worktree) established by the closeout suites.

## 2. References

- Change specification: `./chg-GH-404-spec.md` — source of truth; §17 acceptance criteria and their ticket AC1–AC7 mapping are the coverage contract for this plan.
- Testing strategy: `.ai/rules/testing-strategy.md` — layer/module mapping, hermeticity, invariant-test authoring rules, golden-update discipline.
- Implementation plan: `./chg-GH-404-plan.yaml` — authored in phase 4, immediately after this plan; scenario-to-phase mapping is finalized there.
- Existing suites this plan extends (never duplicates): `tests/behaviour/closeout-worktree.test.ts` and its refusal/idempotency variants, `tests/behaviour/projects-identity.test.ts`, `tests/structure/state-scope.test.ts`, `tests/behaviour/dispatch-harness-lease.test.ts`, `tests/behaviour/dispatch-gate-evidence.test.ts`, `tests/behaviour/dispatch-resume-economics.test.ts`, `tests/behaviour/lanes.test.ts`, `tests/behaviour/board-output.test.ts`, `tests/behaviour/merge-production-composition.test.ts`, `tests/golden/*` output pins, `tests/checks/no-shell-dispatch.test.ts`, `tests/checks/closeout-mutants.test.ts`, `tests/checks/new-code-naming.test.ts`.
- Related decision context: spec §15 (DEC-1..DEC-8), §14 (OQ-1 planning directive, OQ-2 resolved).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-F1-1 | `addWorktree` house style: fixed argv, no shell, local only, no force; git refusal is a refusal | TC-WT-001, TC-WT-002 | Planned |
| AC-F2-1 | Worktree created before the first phase: sibling path, `worktree-root` setting, branch at base tip, physical-path resolution | TC-WT-003, TC-WT-004, TC-WT-005, TC-ENV-001 | Planned |
| AC-F3-1 | Worktree-scoped lane: PATH precedence, gate temp dir inside, deps installed/built, `$PWD/tmp/tmpdir` literal, main checkout clean throughout | TC-ENV-001, TC-ENV-002, TC-ENV-003 | Planned |
| AC-F3-2 | Fresh-worktree provisioning measurement recorded as delivery evidence (no timing assertion) | TC-ENV-004 | Planned (evidence) |
| AC-F4-1 | Resume reuses the worktree, verified branch, never a second worktree | TC-RESUME-001, TC-RESUME-002 | Planned |
| AC-F5-1 | Host index pinned to main checkout; entry survives worktree removal; worktrees never flat rows | TC-HOSTIDX-001, TC-HOSTIDX-002, TC-HOSTIDX-003 | Planned |
| AC-F6-1 | Merge lands a worktree-checked-out branch; closeout sweeps logs then removes only after merge confirmation; stalled lanes keep worktrees | TC-CLOSEOUT-001, TC-CLOSEOUT-002, TC-CLOSEOUT-003, TC-CLOSEOUT-004, TC-CLOSEOUT-005 | Planned |
| AC-F7-1 | `dispatch status`, `lanes`, `board` show the lane's worktree path | TC-SURFACES-001, TC-SURFACES-002 | Planned |
| AC-F8-1 | Exception setting: no worktree; every pinned output byte-identical to today's | TC-REG-001, TC-REG-002 | Planned |
| AC-F9-1 | Linked worktree resolves same clone identity and state root | TC-IDENT-001 | Planned |
| AC-F10-1 | Linked-only enumeration: positional reliance pinned or removed | TC-IDENT-002 | Planned |
| (DEC-8) | Pre-change lane without worktree context resumes as today | TC-RESUME-003 | Planned |

Ticket AC traceability: AC1 → TC-ENV-001 (+TC-WT-003); AC2 → TC-RESUME-001; AC3 → TC-IDENT-001; AC4 → TC-HOSTIDX-001/002; AC5 → TC-CLOSEOUT-001/002; AC6 → TC-SURFACES-001; AC7 → TC-REG-001/002.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface element | TC ID(s) | Notes |
|-------------------|----------|-------|
| DM-1 Lane worktree context (additive) | TC-RESUME-001, TC-RESUME-003, TC-SURFACES-001, TC-SURFACES-002 | Recorded context drives resume and rendering; absence = disable-worktrees shape |
| DM-2 Host-index root pin | TC-HOSTIDX-001, TC-HOSTIDX-002, TC-HOSTIDX-003 | Entry root = main checkout; no prune of a live clone |
| DM-3 `worktree-root` worker setting | TC-WT-003, TC-WT-004 | Default sibling placement; setting honoured |
| DM-4 Disable-worktrees exception setting | TC-REG-001, TC-REG-002 | Byte-for-byte mode |
| DM-5 Clone-identity sharing pin | TC-IDENT-001 | Marker in git common directory unchanged |
| Events/messages | — | No new event kinds (spec §8.2); capsule event kinds unchanged — covered implicitly by existing capsule suites riding `pnpm check` |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Coverage mode |
|-----|-------------|----------|---------------|
| NFR-1 | Seam safety: fixed argv, 0 shell, 0 network, 0 force; refusal surfaced | TC-WT-002 | Unit + source-scan canary (no-shell check pattern) |
| NFR-2 | Main checkout on base branch and clean at every observed point | TC-ENV-001 | Governing fixture |
| NFR-3 | 0 second worktrees across resume attempts | TC-RESUME-001 | Fixture |
| NFR-4 | 0-byte output delta in exception mode | TC-REG-001 | Golden-snapshot regression |
| NFR-5 | Logs swept before removal; removal only after merge confirmation | TC-CLOSEOUT-002, TC-CLOSEOUT-003, TC-CLOSEOUT-005 | Fixtures + mutants |
| NFR-6 | 0 root flips; 0 prunes of a live clone's entry | TC-HOSTIDX-001, TC-HOSTIDX-002 | Fixture |
| NFR-7 | 0 resolutions through a symlinked alias | TC-WT-005 | Fixture |
| NFR-8 | 0 position-dependent reads in linked-only enumeration | TC-IDENT-002 | Guard test |
| NFR-9 | Fresh-worktree provisioning measurement | TC-ENV-004 | Delivery evidence only — **no automated timing assertion by design** (see §8.3) |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`; all suites use `bun:test` under `tests/**`.

- **Unit tests** — `bun test tests/structure tests/behaviour` (narrow: `bun test tests/behaviour/<suite>.test.ts`). Used for the seam contract (argv/refusal matrix), environment derivation, and enumeration guard. Adapter seams are exercised against temporary git repositories created by the harness — no mocks of git itself.
- **Behaviour/Integration tests** — `tests/behaviour/**`: fixture-driven, hermetic; temporary git repositories and temporary state stores created by the test harness (the closeout production-composition pattern: temp repository with a squash landing and a delivery worktree). Used for the lifecycle fixtures (dispatch → resume → merge → closeout), host-index survival, and pre-change-lane resume.
- **Golden/regression tests** — `tests/golden/**`: snapshot pins of rendered output. Used for the exception-mode byte-for-byte guarantee (NFR-4) and the worktree-path visibility additions. Goldens that pin preserved (pre-change) data are updated deliberately in review, never blanket-rewritten.
- **Checks (invariant/canary)** — `tests/checks/**`: source-scan guards in the pattern of `no-shell-dispatch.test.ts` (seam house style), mutants in the pattern of `closeout-mutants.test.ts` (ordering rules), and the existing `new-code-naming.test.ts` baseline which continues to run in `pnpm check`.
- **Evidence-only (manual/delivery)** — TC-ENV-004: measurement recorded in the change pm-notes during delivery. No `*.test.ts` fixture asserts a duration.
- **Aggregate gate** — `pnpm check` (lint → format:check → typecheck → test → check:boundaries) is the final verification; gate evidence during delivery uses `TMPDIR=$PWD/tmp/tmpdir`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-WT-001 | addWorktree creates a linked worktree on a new branch at the base tip | Happy Path | Unit | High | AC-F1-1 |
| TC-WT-002 | addWorktree refusal matrix and house-style canary | Negative | Unit + Check | High | AC-F1-1, NFR-1 |
| TC-WT-003 | Dispatch creates the worktree before the first phase at the sibling path | Happy Path | Behaviour | High | AC-F2-1 |
| TC-WT-004 | `worktree-root` worker setting honoured; default is the sibling placement | Edge Case | Behaviour | Medium | AC-F2-1, DM-3 |
| TC-WT-005 | Paths resolve from the clone's physical location, never a symlinked alias | Corner Case | Behaviour | Medium | AC-F2-1, NFR-7 |
| TC-ENV-001 | Governing fixture AC1: full lifecycle in the worktree; main checkout clean throughout | Happy Path | Behaviour | Critical | AC-F2-1, AC-F3-1, AC-F4-1, NFR-2 |
| TC-ENV-002 | Derived lane environment: PATH precedence and gate temp dir inside the worktree | Happy Path | Behaviour | High | AC-F3-1 |
| TC-ENV-003 | pm-notes evidence keeps the literal `$PWD/tmp/tmpdir` | Regression | Behaviour | Medium | AC-F3-1 |
| TC-ENV-004 | Fresh-worktree provisioning measurement (delivery evidence, no timing assertion) | Manual | Evidence | Medium | AC-F3-2, NFR-9 |
| TC-RESUME-001 | Resume reuses the lane's worktree; never a second worktree | Happy Path | Behaviour | High | AC-F4-1, NFR-3 |
| TC-RESUME-002 | Missing or branch-mismatched worktree is a lane error, not a silent re-provision | Negative | Behaviour | High | AC-F4-1 |
| TC-RESUME-003 | DEC-8: pre-change lane (no worktree context) resumes as today in the main checkout | Regression | Behaviour | High | DEC-8, DM-1 |
| TC-HOSTIDX-001 | Lane commands from the worktree keep the host-index root at the main checkout | Happy Path | Behaviour | Critical | AC-F5-1, NFR-6 |
| TC-HOSTIDX-002 | Worktree removal then maintenance: entry survives; `repos list` keeps its row | Regression | Behaviour | Critical | AC-F5-1, NFR-6 |
| TC-HOSTIDX-003 | Worktrees never appear as rows of the flat record set | Negative | Behaviour | Medium | AC-F5-1 |
| TC-CLOSEOUT-001 | Merge lands a change whose branch is checked out in its worktree | Happy Path | Behaviour | Critical | AC-F6-1 |
| TC-CLOSEOUT-002 | Closeout ordering: logs swept before removal; removal only after merge confirmation | Happy Path | Behaviour | Critical | AC-F6-1, NFR-5 |
| TC-CLOSEOUT-003 | Closeout refusal paths preserve the worktree and the logs | Negative | Behaviour | High | AC-F6-1, NFR-5 |
| TC-CLOSEOUT-004 | Stalled lane without a merge keeps its worktree | Edge Case | Behaviour | Medium | AC-F6-1 |
| TC-CLOSEOUT-005 | Mutants: breaking the ordering rules fails the suite | Canary | Check | High | AC-F6-1, NFR-5 |
| TC-SURFACES-001 | `dispatch status` shows the lane's worktree path | Happy Path | Golden | High | AC-F7-1, DM-1 |
| TC-SURFACES-002 | `lanes` and `board` show the lane's worktree path | Happy Path | Golden | High | AC-F7-1, DM-1 |
| TC-REG-001 | Exception mode byte-for-byte: 0-byte delta on every pinned output | Regression | Golden | Critical | AC-F8-1, NFR-4 |
| TC-REG-002 | Exception mode: lane runs in the main checkout; no worktree created or referenced | Regression | Behaviour | Critical | AC-F8-1 |
| TC-IDENT-001 | Linked worktree resolves the same clone identity and state root as the main checkout | Happy Path | Behaviour | High | AC-F9-1, DM-5 |
| TC-IDENT-002 | Linked-only enumeration guard: positional first-block reliance pinned or removed | Corner Case | Unit | High | AC-F10-1, NFR-8 |

### 5.2 Scenario Details

#### TC-WT-001 - addWorktree creates a linked worktree on a new branch at the base tip

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: git adapter seam suite (new, `tests/behaviour/` — extends the seam-capability pattern of `merge-git-seam-capabilities.test.ts`)
**Tags**: @backend

**Preconditions**:

- Temporary git repository created by the harness, with a base branch and at least one commit.

**Steps**:

1. Invoke the `addWorktree` seam with a target root and a new branch name.
2. Inspect the created directory, its branch, and the linked-worktree listing.

**Expected Outcome**:

- A **linked** worktree exists at the requested path, checked out on the newly created branch whose tip equals the base branch's tip.
- The worktree appears in `listWorktrees` output as a linked entry (the main checkout excluded).
- The invocation is fixed-argv: asserted seam-contract style; no shell, no network, no force flag (see TC-WT-002 for the negative matrix and canary).

**Postconditions**:

- Harness removes the temporary repository tree.

#### TC-WT-002 - addWorktree refusal matrix and house-style canary

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1
**Test Type(s)**: Unit, Check
**Automation Level**: Automated
**Target Layer / Location**: git adapter seam suite (as TC-WT-001) + source-scan check (new, `tests/checks/` — pattern of `no-shell-dispatch.test.ts`)
**Tags**: @backend

**Preconditions**:

- Temporary git repository; a conflicting branch name; an existing directory at the target path; an unwritable parent directory case where the platform allows creating one hermetically.

**Steps**:

1. Invoke the seam with a branch name that already exists — expect a refusal result.
2. Invoke the seam with a target path that already exists — expect a refusal result.
3. Invoke the seam against an unsafe/unwritable parent — expect a refusal result.
4. Assert each refusal is returned as a refusal (typed error/result), and that no retry, fallback, or force path fired.
5. Run the source-scan canary over the adapter's worktree seam implementation: assert no shell invocation, no force-flag token, no network call in the create path; plant a canary (a `--force` token and a shell call) in a scratch copy and assert the canary fails.

**Expected Outcome**:

- Every git refusal surfaces as a refusal — 0 silent retries, 0 overrides, 0 forced creations.
- The canary discipline holds: introducing a force flag or shell invocation into the create path makes the check fail; planted canaries never leak into output, residue, or capsule evidence.

#### TC-WT-003 - Dispatch creates the worktree before the first phase at the sibling path

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-3, NFR-7
**Test Type(s)**: Behaviour (Integration)
**Automation Level**: Automated
**Target Layer / Location**: dispatch engine behaviour suite (new, `tests/behaviour/` — harness pattern of `dispatch-harness-lease.test.ts`)
**Tags**: @backend

**Preconditions**:

- Temporary clone (the "main checkout") on a base branch, clean; harness-provided state store.

**Steps**:

1. Dispatch a work item for the clone.
2. Observe the created worktree path, its branch, and the ordering against the first phase.

**Expected Outcome**:

- The worktree exists at `<worktree-root>/<checkout-basename>-<ref>` — a sibling of the main checkout under the default configuration — created **before** the first phase begins.
- The worktree is on a new branch created at the tip of the base branch.
- The repository lease is claimed before any worktree provisioning (unchanged lease order).

#### TC-WT-004 - `worktree-root` worker setting honoured; default is the sibling placement

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-1, DM-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch behaviour suite (TC-WT-003's suite) + configuration suite (`tests/behaviour/config-schema.test.ts` pattern)
**Tags**: @backend

**Preconditions**:

- Two temporary clones with distinct configured `worktree-root` values (one unset/default, one explicit).

**Steps**:

1. Dispatch with `worktree-root` unset — observe placement.
2. Dispatch with `worktree-root` set to a harness directory — observe placement.
3. Load the configuration through the config suite to confirm both settings parse as additive worker settings.

**Expected Outcome**:

- Default: the worktree is a sibling of the main checkout.
- Explicit: the worktree is created under the configured root, keeping the `<checkout-basename>-<ref>` name.
- Configuration loads unchanged; the new settings are additive with defaults.

#### TC-WT-005 - Paths resolve from the clone's physical location, never a symlinked alias

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-1, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch behaviour suite (TC-WT-003's suite)
**Tags**: @backend

**Preconditions**:

- Temporary clone; a symlink alias pointing at the clone directory (created by the harness inside its own temp workspace).

**Steps**:

1. Invoke dispatch **via the symlinked alias** of the main checkout.
2. Compare the created worktree path and the recorded main-checkout path against the clone's physical location.

**Expected Outcome**:

- The worktree sibling is placed relative to the **physical** clone location (same parent as the real directory), and the host-index entry (TC-HOSTIDX-001) records the physical main-checkout path — 0 resolutions through the alias.

#### TC-ENV-001 - Governing fixture AC1: full lifecycle in the worktree; main checkout clean throughout

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High (Critical fixture)
**Related IDs**: F-2, F-3, F-4, AC-F2-1, AC-F3-1, AC-F4-1, NFR-2 (ticket AC1)
**Test Type(s)**: Behaviour (Integration)
**Automation Level**: Automated
**Target Layer / Location**: dispatch lifecycle behaviour suite (new, `tests/behaviour/` — hermetic production-composition pattern of `merge-production-composition.test.ts` / `closeout-worktree.test.ts`)
**Tags**: @backend

**Preconditions**:

- Temporary clean main checkout on a base branch; harness state store; hermetic harness/hook stubs so all phases run without network or credentials.

**Steps**:

1. Dispatch a work item on the clean main checkout.
2. At every observed point of the lifecycle (after dispatch provisioning, after each phase boundary, before and after resume), record the main checkout's current branch and cleanliness.
3. Run the lane through all phases to `pr_creation`.

**Expected Outcome**:

- A sibling worktree is created for the work item before the first phase (TC-WT-003's assertions hold).
- The lane's phases run inside the worktree.
- At **every** observed point the main checkout is on the base branch and clean — zero deviations (NFR-2).

**Postconditions**:

- Lane completes; worktree still present (closeout is TC-CLOSEOUT-002's concern, not this fixture's).

#### TC-ENV-002 - Derived lane environment: PATH precedence and gate temp dir inside the worktree

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, RSK-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch derivation suite (extends the dispatch derivation/environment behaviour suites in `tests/behaviour/`)
**Tags**: @backend

**Preconditions**:

- Temporary clone with a dependency directory (`node_modules/.bin` seeded by the harness) in the main checkout and a different one in the worktree; a gate stub that records its environment.

**Steps**:

1. Provision the lane's worktree (install/build stage exercised with harness stubs).
2. Run a phase whose command and gate record the effective `PATH` head, working directory, and temporary-directory location.
3. Inspect the recorded environment.

**Expected Outcome**:

- The worktree's `node_modules/.bin` leads `PATH` (main checkout's bin directory does not precede it).
- The gate temporary directory is created **inside** the worktree.
- Dependencies were installed before the first phase, and gate prerequisites were built in the worktree.
- No gate or lane artifact lands in the main checkout (cleanliness re-asserted).

#### TC-ENV-003 - pm-notes evidence keeps the literal `$PWD/tmp/tmpdir`

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-1, DEC-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch evidence suite (extends `dispatch-gate-evidence.test.ts` pattern)
**Tags**: @backend

**Preconditions**:

- Lane running in its worktree (harness stubs record the evidence string the lane writes).

**Steps**:

1. Run a phase that records gate evidence.
2. Inspect the recorded evidence text.

**Expected Outcome**:

- The evidence keeps the literal `$PWD/tmp/tmpdir` — the convention string is unchanged; the physical resolution is inside the lane's worktree because that is the lane's working directory (TC-ENV-002).

#### TC-ENV-004 - Fresh-worktree provisioning measurement (delivery evidence, no timing assertion)

**Scenario Type**: Manual (Evidence)
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-3, AC-F3-2, NFR-9, OQ-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: change pm-notes (`chg-GH-404-pm-notes.yaml` notes entries) during phase 9/10 delivery
**Tags**: @backend

**Preconditions**:

- A fresh worktree provisioned by a real lane during this change's own delivery or a targeted manual run.

**Steps**:

1. During delivery, record **what** the gates need in a fresh worktree (install, build steps) and **how long** it took, as a pm-notes evidence entry.
2. No automated suite asserts any duration or threshold.

**Expected Outcome**:

- The measurement exists as delivery evidence in the pm-notes (NFR-9); GH-412 planning can consume it.
- **Explicitly out of the automated gates**: no `bun test` fixture asserts install/build timing — this plan does not demand a timing assertion (see §8.3).

#### TC-RESUME-001 - Resume reuses the lane's worktree; never a second worktree

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-3, DM-1 (ticket AC2)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch resume suite (extends `dispatch-resume-economics.test.ts` pattern)
**Tags**: @backend

**Preconditions**:

- A lane that ran at least one phase in its worktree and stopped (harness-induced stop).

**Steps**:

1. Record the worktree inventory (linked worktrees of the clone) before resume.
2. Resume the lane.
3. Record the inventory again; inspect the worktree branch.

**Expected Outcome**:

- The lane continues in the **same** worktree, verified to be on the lane's branch.
- The worktree count is unchanged — 0 second worktrees created across repeated resume attempts (assert over ≥2 resumes).

#### TC-RESUME-002 - Missing or branch-mismatched worktree is a lane error, not a silent re-provision

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch resume suite (TC-RESUME-001's suite)
**Tags**: @backend

**Preconditions**:

- A lane with recorded worktree context whose worktree was (a) deleted from disk, (b) moved onto a different branch by the harness.

**Steps**:

1. Resume the lane in case (a) — expect an error result.
2. Resume the lane in case (b) — expect an error result.
3. Inspect the worktree inventory after both attempts.

**Expected Outcome**:

- Both cases surface as lane errors naming the problem; neither silently provisions a replacement worktree; the inventory shows no new worktree.

#### TC-RESUME-003 - DEC-8: pre-change lane (no worktree context) resumes as today in the main checkout

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: DEC-8, DM-1, F-4, AC-F4-1 (compatibility shape)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch resume suite (TC-RESUME-001's suite)
**Tags**: @backend

**Preconditions**:

- A lane record shaped as a pre-change record: no worktree context field (the DM-1 additive-gain shape), stopped mid-lifecycle.

**Steps**:

1. Resume the lane.
2. Inspect the working directory of the resumed phases, the worktree inventory, and the lane's completion/closeout path.

**Expected Outcome**:

- The lane resumes **exactly as today**: it runs in the invoking/main checkout under the disable-worktrees shape (F-8), never provisions a worktree, and completes and closes out under today's behaviour.
- Worktree inventory unchanged — 0 provisioning events for the context-less lane.

#### TC-HOSTIDX-001 - Lane commands from the worktree keep the host-index root at the main checkout

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-6, DM-2 (ticket AC4)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: host-index behaviour suite (extends the host-index/repos registration suites in `tests/behaviour/`)
**Tags**: @backend

**Preconditions**:

- Temporary clone registered in a harness state store (entry root = main checkout path); a lane running in its worktree.

**Steps**:

1. Run several lane commands **from inside the worktree** (dispatch attempt, status read, a phase boundary).
2. After each command, read the host-index entry's root.

**Expected Outcome**:

- After **every** command the entry's root equals the main checkout's path — 0 root flips to the worktree path.

#### TC-HOSTIDX-002 - Worktree removal then maintenance: entry survives; `repos list` keeps its row

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-6, DM-2 (ticket AC4)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: host-index behaviour suite (TC-HOSTIDX-001's suite)
**Tags**: @backend

**Preconditions**:

- State as TC-HOSTIDX-001 after a completed lane; then closeout removes the worktree (TC-CLOSEOUT-002 path).

**Steps**:

1. Remove the worktree (via the delivered closeout path).
2. Run a host-index maintenance pass.
3. Read the flat record set and a group-member resolution over the harness state.

**Expected Outcome**:

- The live clone's entry is **still present** after removal and after maintenance — 0 prunes.
- `repos list` keeps its row; group-member resolution is intact (no degradation).

#### TC-HOSTIDX-003 - Worktrees never appear as rows of the flat record set

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, AC-F5-1, DM-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: host-index/repos behaviour suite (TC-HOSTIDX-001's suite)
**Tags**: @backend

**Preconditions**:

- A clone with one or more lane worktrees present (harness-created).

**Steps**:

1. Enumerate the flat record set while worktrees exist.
2. Compare rows against the clone inventory.

**Expected Outcome**:

- Exactly the registered clones appear as rows; no worktree path appears as a row. Worktrees surface only through the lane surfaces (TC-SURFACES-*).

#### TC-CLOSEOUT-001 - Merge lands a change whose branch is checked out in its worktree

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1 (ticket AC5)
**Test Type(s)**: Behaviour (Integration)
**Automation Level**: Automated
**Target Layer / Location**: merge behaviour suite (extends `merge-production-composition.test.ts` — temp repository with a squash landing and a delivery worktree)
**Tags**: @backend

**Preconditions**:

- Hermetic production composition: temporary repository, lane branch checked out in its worktree, merge staged through harness fakes (no live tracker/PR calls).

**Steps**:

1. Run `merge` for the change whose branch is checked out in the worktree.
2. Run it again from the main checkout for the same change (the "resolved from the worktree or the main checkout" clause).

**Expected Outcome**:

- Both invocations land the change (squash landing recorded); the change is resolved whether merge is invoked from the worktree or the main checkout.

#### TC-CLOSEOUT-002 - Closeout ordering: logs swept before removal; removal only after merge confirmation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-5 (ticket AC5)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closeout worktree suite (extends `tests/behaviour/closeout-worktree.test.ts` and its idempotency variant)
**Tags**: @backend

**Preconditions**:

- A merged lane with logs present in its worktree (harness-seeded log files).

**Steps**:

1. Run closeout for the merged lane.
2. Observe the ordering: log sweep vs. worktree removal vs. merge confirmation.
3. Inspect the swept-log destination and the worktree inventory afterwards.

**Expected Outcome**:

- The lane's logs are swept **before** removal (0 log loss — swept logs retrievable at their destination).
- The worktree is removed **only after** the merge is confirmed — never before (0 removals of unmerged lanes' worktrees).
- After closeout, the worktree is gone (idempotency: a second closeout is a no-op satisfaction, per the existing idempotency suite).

#### TC-CLOSEOUT-003 - Closeout refusal paths preserve the worktree and the logs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closeout refusal suite (extends the `closeout-worktree-refusal` variant)
**Tags**: @backend

**Preconditions**:

- Lanes whose closeout hits each delivered refusal/safety-predicate outcome (unmerged lane, unsatisfied predicate).

**Steps**:

1. Run closeout on each refusal case.
2. Inspect the worktree inventory and the lane's logs after each attempt.

**Expected Outcome**:

- Every refusal leaves the worktree in place and the logs intact — removal is strictly gated by the delivered safety predicate plus the merge-confirmation ordering.

#### TC-CLOSEOUT-004 - Stalled lane without a merge keeps its worktree

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6, AC-F6-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closeout worktree suite (TC-CLOSEOUT-002's suite)
**Tags**: @backend

**Preconditions**:

- A lane that stopped after some phases, no merge recorded.

**Steps**:

1. Attempt closeout (or allow closeout to run at the boundary where the lane has no merge).
2. Inspect the worktree inventory.

**Expected Outcome**:

- The lane keeps its worktree until it is resumed and completes, or is closed out — no removal of a stalled lane's worktree.

#### TC-CLOSEOUT-005 - Mutants: breaking the ordering rules fails the suite

**Scenario Type**: Canary
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-5
**Test Type(s)**: Check (mutation)
**Automation Level**: Automated
**Target Layer / Location**: closeout mutants suite (extends `tests/checks/closeout-mutants.test.ts`)
**Tags**: @backend

**Preconditions**:

- The mutant corpus for the closeout worktree ordering rules.

**Steps**:

1. Apply the "remove before sweep" mutant — assert the suite fails.
2. Apply the "remove before merge confirmation" mutant — assert the suite fails.
3. Assert planted mutants never leak into output, residue, or capsule evidence.

**Expected Outcome**:

- Each named ordering rule is proven load-bearing: the corresponding mutant turns the suite red. Canaries are contained.

#### TC-SURFACES-001 - `dispatch status` shows the lane's worktree path

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-1 (ticket AC6)
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: golden suites (`tests/golden/dispatch-text.test.ts`, `dispatch-summary.test.ts` pattern)
**Tags**: @backend

**Preconditions**:

- A lane with a worktree (harness-created); golden snapshots for `dispatch status` regenerated for the worktree shape.

**Steps**:

1. Run `dispatch status` for the lane.
2. Compare output against the golden snapshot.

**Expected Outcome**:

- The lane's worktree path is present in `dispatch status` output; the golden pins the exact rendered form.

#### TC-SURFACES-002 - `lanes` and `board` show the lane's worktree path

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-1
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: golden suites (`tests/golden/lanes-list.test.ts`, `lanes-show.test.ts`, `board-grid.test.ts` pattern) + `tests/behaviour/board-lanes.test.ts`
**Tags**: @backend

**Preconditions**:

- As TC-SURFACES-001.

**Steps**:

1. Run `lanes` (list and show) for the worktree lane.
2. Run `board` covering the lane.
3. Compare against regenerated goldens.

**Expected Outcome**:

- Both surfaces show the lane's worktree path; 3 of 3 surfaces satisfy goal 7 together with TC-SURFACES-001.

#### TC-REG-001 - Exception mode byte-for-byte: 0-byte delta on every pinned output

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High (Critical regression)
**Related IDs**: F-8, AC-F8-1, NFR-4, DM-4 (ticket AC7, RSK-4)
**Test Type(s)**: Golden (Regression)
**Automation Level**: Automated
**Target Layer / Location**: golden suites across the pinned surfaces: dispatch (text/summary/errors), resume, `dispatch status`, `lanes` (list/show), `board` (grid), `merge`, closeout (envelope/residue) — exception-mode goldens pin **today's pre-change output**
**Tags**: @backend

**Preconditions**:

- The disable-worktrees exception setting set in the harness configuration; the delivered goldens capture today's behaviour (the pins are the preserved data).

**Steps**:

1. Run dispatch (default mode off — exception set) and compare the full output to the pre-change golden.
2. Repeat for resume, `dispatch status`, `lanes` (list + show), `board`, `merge`, and closeout.
3. Assert the exception-mode goldens equal the pre-change goldens byte-for-byte.

**Expected Outcome**:

- 0-byte delta on every pinned surface with the setting set (NFR-4).
- Golden discipline per the testing strategy: pins of preserved data are updated deliberately in review, never blanket-rewritten; if a pinned surface legitimately changes in a later change, the pre-change pins for the exception mode are the ones that must keep matching today's behaviour at that time.

#### TC-REG-002 - Exception mode: lane runs in the main checkout; no worktree created or referenced

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: dispatch lifecycle suite (TC-ENV-001's suite, exception-mode variant)
**Tags**: @backend

**Preconditions**:

- Exception setting set; clean main checkout.

**Steps**:

1. Dispatch a work item; run the lifecycle; run merge and closeout.
2. Inspect the working directories of every phase, the worktree inventory, and every pinned output's references.

**Expected Outcome**:

- No worktree is created or referenced anywhere in the run; the lane runs in the main checkout exactly as today.

#### TC-IDENT-001 - Linked worktree resolves the same clone identity and state root as the main checkout

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-5 (ticket AC3)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: identity suites (extends `tests/behaviour/projects-identity.test.ts` and `tests/structure/state-scope.test.ts`)
**Tags**: @backend

**Preconditions**:

- Temporary clone with a harness-created linked worktree; state root resolved through the delivered scope resolution.

**Steps**:

1. Resolve the clone identity from the main checkout and from the linked worktree.
2. Resolve the state root from both.
3. Inspect the identity marker location.

**Expected Outcome**:

- Clone identity is identical from both — the marker lives in the git common directory and is unchanged.
- The state root is identical from both — never a path-derived substitute key (a worktree-local substitute would differ and must fail this test).

#### TC-IDENT-002 - Linked-only enumeration guard: positional first-block reliance pinned or removed

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-8, DEC-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: git adapter structure/behaviour suite (new guard in the adapter suite area, `tests/structure/` or `tests/behaviour/`)
**Tags**: @backend

**Preconditions**:

- A temporary clone with its main checkout plus ≥1 linked worktree (so the porcelain listing has ≥2 blocks).

**Steps**:

1. Run the linked-worktree enumeration and the branch-checked-out-elsewhere check over the multi-block listing.
2. Assert the linked-only reading: the main checkout is excluded from the linked inventory, linked worktrees are included, regardless of block order.
3. Decide the guard form per the spec's either/or: pin the positional first-block drop with a test that fails if the position assumption breaks, or make the reads position-independent and assert order-insensitivity by shuffling fixture block order.

**Expected Outcome**:

- The linked-only reading holds with 0 position-dependent reads — the chosen guard form is part of the quality gates, and the branch-elsewhere check receives the same treatment.

## 6. Environments and Test Data

- **Environment**: local developer/CI only (the strategy's hermetic tier). No staging, no live tracker, no live network, no live credentials.
- **Test data generation**: temporary git repositories (base branch + commits), harness-created linked worktrees, seeded dependency directories (`node_modules/.bin` stubs), harness-seeded lane logs, and temporary state stores (host index, lane records, flat record set) — all created and cleaned up by the test harness, mirroring the closeout production-composition pattern (temp repository with a squash landing and a delivery worktree).
- **Symlink fixtures**: TC-WT-005 creates its symlink strictly inside the harness's own temporary workspace.
- **Isolation**: suites must remain order-independent and parallel-safe, in line with the existing test-isolation checks (`tests/checks/projects-test-isolation.test.ts`, `dispatch-attempts-test-isolation.test.ts`, `dispatch-operator-test-isolation.test.ts`); new suites inherit the same harness isolation conventions so no cross-suite residue.
- **Merge fakes**: tracker/PR interactions are harness fakes — the no-live-calls discipline of the existing merge checks (`merge-deploy-no-live-calls.test.ts` pattern) applies to the new worktree merge paths.
- **Gate evidence during delivery**: commands run for evidence use `TMPDIR=$PWD/tmp/tmpdir`; record commands run + result summary in the change artifacts (per strategy).
- **Aggregate gate**: `pnpm check` — including the GH-406 naming check with its committed baseline (`tests/checks/new-code-naming.test.ts`), which continues to govern all new code in this change.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file (create/update) | Command | Mocking/harness requirements | Status |
|-------|---------------------------|---------|------------------------------|--------|
| TC-WT-001 | `tests/behaviour/git-adapter-worktree-seam.test.ts` (new) | `bun test tests/behaviour/git-adapter-worktree-seam.test.ts` | Temp git repository harness | To Implement |
| TC-WT-002 | `tests/behaviour/git-adapter-worktree-seam.test.ts` + `tests/checks/worktree-seam-house-style.test.ts` (new, no-shell pattern) | `bun test tests/behaviour/git-adapter-worktree-seam.test.ts tests/checks/worktree-seam-house-style.test.ts` | Refusal fixtures; source-scan canary | To Implement |
| TC-WT-003 | `tests/behaviour/dispatch-worktree-lifecycle.test.ts` (new) | `bun test tests/behaviour/dispatch-worktree-lifecycle.test.ts` | Temp clone + state store; phase-stub harness | To Implement |
| TC-WT-004 | `tests/behaviour/dispatch-worktree-lifecycle.test.ts` + `tests/behaviour/config-schema.test.ts` (update) | `bun test tests/behaviour/dispatch-worktree-lifecycle.test.ts tests/behaviour/config-schema.test.ts` | Two-clone fixture; config fixtures | Existing – Update (config suite); To Implement (lifecycle) |
| TC-WT-005 | `tests/behaviour/dispatch-worktree-lifecycle.test.ts` | `bun test tests/behaviour/dispatch-worktree-lifecycle.test.ts` | Symlink fixture inside temp workspace | To Implement |
| TC-ENV-001 | `tests/behaviour/dispatch-worktree-lifecycle.test.ts` | `bun test tests/behaviour/dispatch-worktree-lifecycle.test.ts` | Full hermetic phase stubs; cleanliness probes | To Implement |
| TC-ENV-002 | `tests/behaviour/dispatch-worktree-lifecycle.test.ts` (or a sibling derivation suite) | `bun test tests/behaviour/dispatch-worktree-lifecycle.test.ts` | Env-recording gate stub; seeded bins | To Implement |
| TC-ENV-003 | `tests/behaviour/dispatch-gate-evidence.test.ts` (update) | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | Evidence-recording stub | Existing – Update |
| TC-ENV-004 | Change pm-notes (`chg-GH-404-pm-notes.yaml`) — notes entry, no test file | — (evidence during delivery) | Real lane or targeted manual run | Manual Only |
| TC-RESUME-001 | `tests/behaviour/dispatch-resume-economics.test.ts` (update) + lifecycle suite | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | Stoppable lane harness | Existing – Update |
| TC-RESUME-002 | `tests/behaviour/dispatch-resume-economics.test.ts` (update) | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | Deleted/moved worktree fixtures | Existing – Update |
| TC-RESUME-003 | `tests/behaviour/dispatch-resume-economics.test.ts` (update) | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | Pre-change lane-record fixture (no worktree context) | Existing – Update |
| TC-HOSTIDX-001 | `tests/behaviour/host-index-worktree-pin.test.ts` (new) | `bun test tests/behaviour/host-index-worktree-pin.test.ts` | Temp clone + host-index store | To Implement |
| TC-HOSTIDX-002 | `tests/behaviour/host-index-worktree-pin.test.ts` | `bun test tests/behaviour/host-index-worktree-pin.test.ts` | Maintenance pass + flat-record reads | To Implement |
| TC-HOSTIDX-003 | `tests/behaviour/host-index-worktree-pin.test.ts` | `bun test tests/behaviour/host-index-worktree-pin.test.ts` | Worktree-present inventory fixture | To Implement |
| TC-CLOSEOUT-001 | `tests/behaviour/merge-production-composition.test.ts` (update) | `bun test tests/behaviour/merge-production-composition.test.ts` | Temp repo + squash landing + delivery worktree; merge fakes | Existing – Update |
| TC-CLOSEOUT-002 | `tests/behaviour/closeout-worktree.test.ts` + `closeout-worktree-idempotency.test.ts` (update) | `bun test tests/behaviour/closeout-worktree.test.ts tests/behaviour/closeout-worktree-idempotency.test.ts` | Seeded lane logs; merge-confirmation fixture | Existing – Update |
| TC-CLOSEOUT-003 | `tests/behaviour/closeout-worktree-refusal.test.ts` (update) | `bun test tests/behaviour/closeout-worktree-refusal.test.ts` | Refusal/predicate fixtures | Existing – Update |
| TC-CLOSEOUT-004 | `tests/behaviour/closeout-worktree.test.ts` (update) | `bun test tests/behaviour/closeout-worktree.test.ts` | Stalled-lane fixture | Existing – Update |
| TC-CLOSEOUT-005 | `tests/checks/closeout-mutants.test.ts` (update) | `bun test tests/checks/closeout-mutants.test.ts` | Mutant corpus for the two ordering rules | Existing – Update |
| TC-SURFACES-001 | `tests/golden/dispatch-text.test.ts` / `dispatch-summary.test.ts` (update) | `bun test tests/golden/dispatch-text.test.ts tests/golden/dispatch-summary.test.ts` | Worktree-lane fixture; golden regeneration command | Existing – Update |
| TC-SURFACES-002 | `tests/golden/lanes-list.test.ts`, `lanes-show.test.ts`, `board-grid.test.ts` + `tests/behaviour/board-lanes.test.ts` (update) | `bun test tests/golden/lanes-list.test.ts tests/golden/lanes-show.test.ts tests/golden/board-grid.test.ts tests/behaviour/board-lanes.test.ts` | Worktree-lane fixture; goldens | Existing – Update |
| TC-REG-001 | Exception-mode golden pins across the pinned surfaces (new fixture files or golden cases within the suites above) | `bun test tests/golden` | Exception setting in harness config; pre-change goldens preserved | To Implement |
| TC-REG-002 | `tests/behaviour/dispatch-worktree-lifecycle.test.ts` (exception-mode variant) | `bun test tests/behaviour/dispatch-worktree-lifecycle.test.ts` | Exception setting; no-worktree assertion | To Implement |
| TC-IDENT-001 | `tests/behaviour/projects-identity.test.ts` + `tests/structure/state-scope.test.ts` (update) | `bun test tests/behaviour/projects-identity.test.ts tests/structure/state-scope.test.ts` | Linked-worktree fixture | Existing – Update |
| TC-IDENT-002 | Linked-only enumeration guard (new, `tests/structure/` or `tests/behaviour/` in the adapter suite area) | `bun test tests/structure` (narrow: the guard file) | Multi-block porcelain fixture (main + linked) | To Implement |

Final verification for every implemented suite: `pnpm check` (the aggregate gate), with delivery evidence recorded under `TMPDIR=$PWD/tmp/tmpdir`.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| RSK-T1 | Byte-for-byte goldens are brittle: legitimate future surface changes force deliberate golden updates, and a lazy rewrite could mask a real exception-mode drift | Exception-mode pins capture **preserved** data (today's behaviour) per the strategy's golden discipline: regenerate only with an explicit command in review; TC-REG-001 states the update rule; canary discipline keeps drift visible |
| RSK-T2 | The porcelain positional pin (TC-IDENT-002) may be brittle across git versions | The spec allows either guard form; if the pinned-position test proves brittle, the position-independent form is the fallback (already planned as the alternative) |
| RSK-T3 | Hermetic worktree fixtures leak residue (stray directories, state-store rows) across suites | Harness-owned temp roots with cleanup postconditions; existing test-isolation checks extended to the new suites |
| RSK-T4 | Timing flakiness if provisioning cost were asserted | By design no timing assertion exists (TC-ENV-004); the measurement lives in the pm-notes only |
| RSK-T5 | Lifecycle fixture (TC-ENV-001) becomes slow with real install/build steps | Harness stubs for install/build inside the suite; the real install/build cost is measured once during delivery (TC-ENV-004), not in the automated suite |
| RSK-T6 | New suites assert against a moving base (strategy prohibition) | All new suites are tree invariants over harness fixtures; no `origin/main-tools...HEAD` diff assertions anywhere in this plan |

### 8.2 Assumptions

- The test harness can create temporary git repositories, linked worktrees, symlink fixtures, and temporary state stores hermetically — the pattern exists (closeout production composition, boundary fixture manifests) and extends.
- git is available in CI at a version whose linked-worktree porcelain listing supports the TC-IDENT-002 guard.
- The existing closeout refusal/idempotency suites and merge production composition extend cleanly to the worktree-checked-out shapes without re-architecting their harnesses.
- The disable-worktrees exception setting and `worktree-root` are settable through the harness configuration the same way as existing worker settings.
- Golden snapshots for the pinned surfaces exist today or are trivially captured pre-change so the exception-mode pins equal the pre-change output.

### 8.3 Open Questions

| ID | Question | Status |
|----|----------|--------|
| — | OQ-1 (fresh-worktree gate prerequisites and timing): settled during planning per the spec's directive. **This plan asserts nothing about timing** — TC-ENV-004 records the measurement as delivery evidence in the pm-notes during delivery (NFR-9); no `bun test` fixture may assert an install/build duration. | No open questions blocking this plan |
| — | OQ-2 (pre-change lane resume): resolved in the spec as DEC-8; covered by TC-RESUME-003. | Resolved |
| — | TC-IDENT-002's guard form (positional pin vs position-independence): the spec leaves the choice to the plan; the implementing change picks one and the other remains the documented fallback. This is an implementation choice inside the plan, not an open requirement question. | To settle at implementation (either outcome satisfies AC-F10-1) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-25 | test-plan-writer agent | Initial test plan from the completed GH-404 specification (§17 AC-F1-1..AC-F3-2, DEC-8, NFR-1..NFR-9): 26 scenarios across 8 feature areas; every spec AC covered; TC-ENV-004 established as evidence-only (no timing assertion) |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during execution (phases 6/9); aggregate gate evidence via `pnpm check` with `TMPDIR=$PWD/tmp/tmpdir` |
