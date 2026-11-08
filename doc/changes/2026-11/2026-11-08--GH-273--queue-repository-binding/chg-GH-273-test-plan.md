---
id: chg-GH-273-test-plan
status: Updated
created: 2026-11-08
last_updated: 2026-11-08T17:54:35Z
owners: [engineering]
service: delivery-os
labels: [bug, queue, scheduling, cli-composition, m1-s9, regression]
version_impact: patch
summary: "Prove the CLI composition emits the queue repository key and the declaring checkout's root as one atomic pair derived from a single repository-facts resolution, restore add/list/dispatch observability, and close the coverage gap with pre-fix-failing regression tests."
links:
  change_spec: ./chg-GH-273-spec.md
  implementation_plan: null # chg-GH-273-plan.yaml not authored at test-planning time; add the path when delivery_planning completes
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Fix the production queue repository binding so key and root always travel together

## 1. Scope and Objectives

This plan protects one behaviour: the production CLI composition either records the queue repository identity as a **complete pair** (`repository` = normalized `host/owner/name` key, `repositoryRoot` = the declaring checkout's resolved absolute root) or records **no repository identity at all** — never one field alone. The data-integrity risk is a partially identified queue entry: it is refused at the domain boundary today (so the queue stays empty) and, if the invariant were ever softened, would silently split one contention domain into two or make a deploy-expectation lookup impossible. The regressions that motivated the plan are the reported falsifications — `queue add` refused with `input.value.rejected`, `queue list` empty, `dispatch` refusing with `queue.entry.unobserved` — plus the false-green coverage gap that let a one-line producer defect survive a full green suite.

The plan's central discipline is the one called out by spec DEC-5 / RSK-4: composition-level tests must execute the **real** binding derivation. They inject only the origin remote; the checkout root always comes from the real working directory's git metadata, and no test seam accepts a synthetic root.

### 1.1 In Scope

- Production-composition add over a real temporary checkout whose `.git` metadata is real on-disk state (fabricated, not fixture-supplied values).
- The full key-resolved × root-resolved matrix (four cells) and the pair-or-absent totality rule.
- Root sourcing: absolute value, nested working directory, linked worktree, top-level/nested equality.
- Normalized key form across the accepted remote shapes, and mutual consistency of the recorded pair.
- Dispatch identity precedence over the recorded scheduler key.
- Read-surface behaviour: `queue list`/`plan`, `lanes`, `dispatch` observation, and root non-disclosure.
- Domain negative coverage for one-sided add requests and one-sided stored records (domain code unchanged).
- Structural anti-recurrence checks: one derivation site, no partial binding literal, fixture shape.

### 1.2 Out of Scope & Known Gaps

- No relaxation or redesign of the queue domain invariant, error table, envelope shapes, exit projections, or dispatch semantics (spec NG-1…NG-6).
- No deploy-expectation port wiring; the recorded root's live consumer stays out of scope (spec NG-3).
- No state migration or dual-read path (spec DEC-8).
- Pilot fixture synthetic key-domain normalization is deferred (spec §7.3, DEC-7); the pilot does not call `queue add`.
- A real `git worktree add` spawn is **not** used; linked-worktree metadata is fabricated on disk exactly as `tests/behaviour/status-repository.test.ts` already does. Justification: `readRepositoryFacts` is a pure filesystem read that already has its own real-gitfile coverage; spawning git in the queue suite would add runtime and environment dependence without exercising new code.
- A full six-cell composition property test (no origin, non-GitHub remote, unnormalizable remote, missing git directory, nested, linked worktree) is deferred per spec §7.3 until a second producer exists.
- NFR-2's `status`/`brief` surfaces are asserted for **root absence only** (no exit-code assertion), because they are composed over a deliberately degraded credential port. See §8.3 OQ-F.
- An implementation plan does not exist yet; scenario→phase sequencing will be reconciled by `@plan-writer`, but AC→TC traceability here is stable.

## 2. References

- Change spec: [chg-GH-273-spec.md](./chg-GH-273-spec.md) — AC-F1-1…AC-F6-4, DEC-1…DEC-8, DM-1…DM-3, NFR-1…NFR-8.
- Implementation plan: not authored yet (`chg-GH-273-plan.yaml` expected).
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md).
- TypeScript workspace rules: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md).
- System spec, scheduling engine contract: [doc/spec/features/feature-scheduling-engine.md](../../../spec/features/feature-scheduling-engine.md).
- System spec, CLI entrypoint/composition: [doc/spec/features/feature-cli-entrypoint.md](../../../spec/features/feature-cli-entrypoint.md).
- Dispatch identity authority: [TDR-0015](../../../decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md).
- Ticket: GH-273.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Every AC is mapped below to the TC that satisfies it and to its evidence class, per spec §17 "Verification method": **permanent suite** (a committed assertion that runs in `pnpm check`), **mutation-verified** (a committed assertion whose detection is demonstrated by a named in-review mutation, because the pre-fix code already exhibits the guarded behaviour), or **review-verified** (diff-level evidence recorded in the change review, backed by the existing pinned tests).

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | Production composition over a resolvable GitHub origin: add is `added`/`noop` at exit 0 and the entry carries both `repository` and `repositoryRoot`. | TC-BIND-001, TC-BIND-010 | Permanent suite (+ revert check) | Covered |
| AC-F1-2 | Key unresolved while a root exists: no binding (no root-only record), add succeeds, entry carries neither field. | TC-BIND-002 (cell key✗/root✓) | Mutation-verified (asymmetry mutation, §8.3 OQ-A) | Covered — symmetry guard |
| AC-F1-3 | Root unresolved while an origin is supplied: no binding (no key-only record), add succeeds, entry carries neither field. | TC-BIND-002 (cell key✓/root✗) | Permanent suite (+ revert check) | Covered — revert-detecting guard |
| AC-F1-4 | Exactly one queue repository-binding derivation site; pair-or-absent; no other site constructs a queue composition with a binding literal. | TC-BIND-014 | Permanent suite (structural) | Covered |
| AC-F2-1 | Nested working directory: recorded root is the checkout root, not the nested directory. | TC-BIND-003 | Permanent suite (+ revert check) | Covered |
| AC-F2-2 | Linked worktree records its own root; top-level and nested invocations of the same checkout record the same absolute root. | TC-BIND-004 | Permanent suite (+ revert check) | Covered |
| AC-F2-3 | Recorded root is absolute; the add performs no process spawn and no network call; the "no additional repository-facts resolution" half is carried by the structural single-resolution assertion instead of an unobservable runtime counter. | TC-BIND-001, TC-BIND-005, TC-BIND-016 | Permanent suite (runtime half) + permanent suite structural (resolution half) | Covered (§8.3 OQ-D) |
| AC-F3-1 | HTTPS ± `.git`, SSH URL, scp-style, mixed case all record the same lowercase `host/owner/name`, consistent with the normalized remote of the recorded root. | TC-BIND-006 | Permanent suite (+ revert check) | Covered |
| AC-F3-2 | With no persisted identity marker, dispatch identity resolves from the entry's scheduler key (source `scheduler`) when exercised directly at the resolver level against a disagreeing remote-derived identity. | TC-BIND-007 (resolver unit assertion) | Permanent suite (direct unit assertion) | Covered — end-to-end covers AC-F4-2 only (§8.3 OQ-E) |
| AC-F4-1 | `queue list` observes the entry with the normalized key; the root appears nowhere in JSON/text output, nor in the `status`/`brief` renderings (absence only, no exit-code assertion). | TC-BIND-008 | Permanent suite (+ revert check) | Covered (§8.3 OQ-F) |
| AC-F4-2 | `queue claim`/`queue plan` observe the ref and `dispatch` no longer refuses with `queue.entry.unobserved`. | TC-BIND-009 | Permanent suite (+ revert check) | Covered |
| AC-F5-1 | Key-only and root-only add requests are refused with `input.value.rejected` naming the invariant. | TC-BIND-011 | Mutation-verified (write-side predicate mutation, §8.3 OQ-B) | Covered |
| AC-F5-2 | A stored record with exactly one field fails the read closed as a torn store; nothing fabricated or dropped. | TC-BIND-012 | Mutation-verified (read-side predicate mutation, §8.3 OQ-B) | Covered |
| AC-F5-3 | No error row added/retired; the invariant keeps both branches unchanged (no condition softened or removed). | TC-BIND-013 | Review-verified diff + existing pinned error-set suite | Covered (§8.3 OQ-E) |
| AC-F6-1 | Reverting the producer fix in place makes the composition add test and the root-unresolved guard test fail; the key-unresolved guard is a symmetry guard detected by an in-place asymmetry mutation (root-only emission observed failing, then restored). | TC-BIND-018 | Review-verified (revert + asymmetry mutation procedure) | Covered — not a permanent suite |
| AC-F6-2 | Both one-sided request shapes and the one-sided record read are covered by explicit assertions. | TC-BIND-011, TC-BIND-012 | Mutation-verified (one predicate mutation per layer) | Covered (§8.3 OQ-B) |
| AC-F6-3 | Every fixture composing a binding supplies both fields or none; the pilot binding's key equals its ledger seeds' key. | TC-BIND-015 | Permanent suite (structural, revert-detecting) | Covered |
| AC-F6-4 | Ticket repro (add → list → dispatch) passes after the fix; the pre-fix failure triple is encoded explicitly in the test rather than by running reverted code. | TC-BIND-010 | Permanent suite (encoded pre-fix triple) | Covered (§8.3 OQ-G) |

All 18 acceptance criteria (AC-F1-1…AC-F6-4) are mapped; no AC is unmapped or marked TODO.

Functional capabilities F-1…F-6 are covered transitively: F-1 → TC-BIND-001/002/014; F-2 → TC-BIND-003/004/005/016; F-3 → TC-BIND-006/007; F-4 → TC-BIND-008/009/010; F-5 → TC-BIND-011/012/013; F-6 → TC-BIND-010/011/012/014/015/018.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No API or EVT identifiers are declared by the spec (§8.1, §8.2 — none). Data-model and command-surface coverage:

| Interface element | Observable contract | TC ID(s) |
|-------------------|---------------------|----------|
| DM-1 queue entry `repository` | Normalized `host/owner/name` from the same origin resolution as the root; absent together with DM-2. | TC-BIND-001, TC-BIND-006, TC-BIND-007 |
| DM-2 queue entry `repositoryRoot` | Absolute declaring checkout root; present only with DM-1; never projected. | TC-BIND-001, TC-BIND-003, TC-BIND-004, TC-BIND-005, TC-BIND-008 |
| DM-3 derivation outcome | Pair or absent; no third state for any fact combination. | TC-BIND-001, TC-BIND-002, TC-BIND-014 |
| `queue add` (grammar unchanged) | Unchanged envelope/exit; outcome changes from guaranteed refusal to `added`/`noop`. | TC-BIND-001, TC-BIND-010 |
| `queue list` | Unchanged shape; entry appears with normalized key; root absent. | TC-BIND-008, TC-BIND-010 |
| `queue plan`, `queue claim`, `queue release`, `lanes *` | Unchanged shape; observe composition-produced entries. | TC-BIND-009, TC-BIND-008 |
| `dispatch` (grammar unchanged) | No `queue.entry.unobserved` for a ref added by the fixed composition. | TC-BIND-009, TC-BIND-010 |
| Production composition seam (`ProductionCompositionFacts.repositoryFacts`) | Injected value supplies the origin only; root always resolved from `cwd`. | TC-BIND-001, TC-BIND-003, TC-BIND-004, TC-BIND-005, TC-BIND-016 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Notes |
|--------|-------------------------|----------|-------|
| NFR-1 | Binding totality: 0 one-sided bindings over the four-cell matrix. | TC-BIND-002 | Each cell asserted explicitly, not just "no throw". |
| NFR-2 | Root never appears in envelopes, findings, incidents, logs, telemetry, or the derived graph. | TC-BIND-008, TC-BIND-009 | Behavioural absence over queue/lanes/plan/claim/release/status/brief/dispatch output + graph document; `status`/`brief` asserted for absence only, with no exit-code assertion (§8.3 OQ-F). Source allowlist guards new disclosure sites. |
| NFR-3 | No grammar, envelope shape, key order, exit projection, or error-identity change. | TC-BIND-013 + existing goldens/error-table suites | Review-verified diff plus the pinned queue-row fixture (zero new/removed error rows); no permanent suite asserts a diff against a moving base. |
| NFR-4 | Coverage strength: every regression test over changed behaviour fails against the pre-fix producer; tests over unchanged behaviour are proven by a targeted mutation instead. Threshold: 1 in-place revert check per behaviour-changing layer (composition add, root-unresolved branch, fixture shape), 1 asymmetry mutation for the key-unresolved symmetry guard, 1 predicate mutation per domain-negative layer, 0 tests asserting only a fixture-supplied pair. | Revert: TC-BIND-001/002 (cell key✓/root✗)/003/004/005/006/007/008/009/010/014/015/017, executed through TC-BIND-018. Asymmetry mutation: TC-BIND-002 (cell key✗/root✓). Predicate mutations: TC-BIND-011 (write side), TC-BIND-012 (read side). | Revert and mutations are review gates, not permanent tests; the exact procedure is in TC-BIND-018 and §8.3 OQ-A/OQ-B. |
| NFR-5 | 0 spawns, 0 outbound calls, 1 facts resolution per invocation on the add path. | TC-BIND-005, TC-BIND-016 | Spawn/network asserted at runtime; "1 resolution" asserted structurally. The runtime counters are the accepted observable proxy for the unobservable resolution count (§8.3 OQ-D). |
| NFR-6 | Binding determinism: the same checkout (same key and root) yields the same binding under identical facts and arguments. | TC-BIND-006, TC-BIND-017 | Binding-level determinism only; byte-identical replay of wall-clock-derived envelope fields is out of scope for this change (§8.3 OQ-C). |
| NFR-7 | Root absolute, identical from top level and nested, worktree-correct. | TC-BIND-003, TC-BIND-004, TC-BIND-005 | |
| NFR-8 | No measurable added work; 0 additional git reads/spawns. | TC-BIND-005, TC-BIND-016 | Suite wall-clock recorded as informational in §10. |

## 4. Test Types and Layers

All new tests are `bun:test` suites under `tests/**`, discovered by `bun test` / `pnpm test`; fixtures never use the `*.test.ts` suffix.

- **Unit / pure-domain (`tests/behaviour`, direct imports):** domain-level negative coverage of `declareQueueEntry`, `readQueueEntries`, and `resolveDispatchIdentity`. No CLI, no store edge beyond a temp `makeAuditStore`. TC-BIND-011, TC-BIND-012, the resolver assertion inside TC-BIND-007, and the normalizer rows inside TC-BIND-006.
- **Integration / behaviour (`tests/behaviour`, real CLI + production composition):** `createProductionComposer` → `createConfigProgram` → `runCli`, with only external seams injected (origin remote, credential port, harness spawn runner, GitHub transport). The checkout, its `.git` metadata, the state store, and the queue ledger are real temp files. TC-BIND-001…TC-BIND-010, TC-BIND-017.
- **Structural (`tests/structure`, source/AST + fixture invariants):** TypeScript AST assertions over `packages/cli/src` and `tests/fixtures/**`; no execution of the composition. TC-BIND-014, TC-BIND-015, TC-BIND-016.
- **Existing automated invariants (no change):** TC-BIND-013 rides `tests/structure/queue-scheduling-contract.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, and the queue golden suites.
- **Manual / review (evidence class: review-verified):** TC-BIND-018 (in-place producer revert plus the key-unresolved asymmetry mutation and the two domain-predicate mutations), and the diff-level half of TC-BIND-013.
- **Evidence classes used in this plan:** permanent suite (TC-BIND-001…010, 014…017), mutation-verified (TC-BIND-002 cell key✗/root✓, TC-BIND-011, TC-BIND-012, TC-BIND-016), review-verified (TC-BIND-013, TC-BIND-018).
- **Performance:** no new performance suite. NFR-8 is asserted as "no additional spawn/read" plus a recorded informational wall-clock.

Runtime expectations: each new behaviour file under ~3 s locally on a warm bun cache (about 8–12 CLI invocations, no network, no sleep, no real git spawn in fixtures); each structural file under ~0.5 s (AST over a handful of files); all four new files under ~6 s combined. The pilot conformance suites keep their existing runtime and must stay green unchanged.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | Evidence Class | AC Coverage |
|-------|-------|------|-------|----------|----------------|-------------|
| TC-BIND-001 | Production add records the atomic pair | Happy Path | Integration | High | Permanent suite | AC-F1-1, AC-F2-3, DM-1, DM-2, DM-3 |
| TC-BIND-002 | Binding totality across the four-cell resolution matrix | Regression | Integration | High | Permanent suite + mutation-verified (key-unresolved cell) | AC-F1-2, AC-F1-3, NFR-1, DM-3 |
| TC-BIND-003 | Nested working directory records the checkout root | Edge Case | Integration | High | Permanent suite | AC-F2-1, NFR-7 |
| TC-BIND-004 | Linked worktree records its own root; top-level equals nested | Corner Case | Integration | High | Permanent suite | AC-F2-2, NFR-7 |
| TC-BIND-005 | Root is absolute and add performs no spawn or network call | Regression | Integration | High | Permanent suite | AC-F2-3, NFR-5, NFR-8 |
| TC-BIND-006 | Normalized key for every accepted remote form, mutually consistent | Regression | Integration | High | Permanent suite | AC-F3-1, DM-1, NFR-6 |
| TC-BIND-007 | Dispatch identity resolves from the recorded scheduler key | Regression | Integration + Unit | High | Permanent suite | AC-F3-2, AC-F4-2, DM-1 |
| TC-BIND-008 | List observes the entry and no read surface leaks the root | Happy Path + Negative | Integration | High | Permanent suite | AC-F4-1, NFR-2, NFR-3 |
| TC-BIND-009 | Claim/plan observe and dispatch passes the observation gate | Regression | Integration | High | Permanent suite | AC-F4-2 |
| TC-BIND-010 | Ticket repro sequence: add → list → dispatch | Regression | Integration | High | Permanent suite (encoded pre-fix triple) | AC-F6-4, AC-F1-1, AC-F4-2 |
| TC-BIND-011 | Domain refuses one-sided add requests (key-only, root-only) | Negative | Unit | High | Mutation-verified | AC-F5-1, AC-F6-2 |
| TC-BIND-012 | One-sided stored record fails closed as a torn store | Negative | Unit + Integration | High | Mutation-verified | AC-F5-2, AC-F6-2 |
| TC-BIND-013 | Queue error identities and invariant branches unchanged | Regression | Structural + Manual | Medium | Review-verified | AC-F5-3, NFR-3 |
| TC-BIND-014 | Exactly one derivation site, never a partial binding literal | Regression | Structural | High | Permanent suite | AC-F1-4 |
| TC-BIND-015 | Fixture shape: both fields or none; pilot key matches seeds | Regression | Structural | Medium | Permanent suite | AC-F6-3 |
| TC-BIND-016 | One repository-facts resolution per composition | Regression | Structural | Medium | Permanent suite + mutation-verified | AC-F2-3, NFR-5 |
| TC-BIND-017 | Binding determinism across replays | Edge Case | Integration | Medium | Permanent suite | NFR-6 |
| TC-BIND-018 | Pre-fix failure verification by in-place revert and asymmetry mutation | Regression | Manual | High | Review-verified | AC-F6-1, NFR-4 |

### 5.2 Scenario Details

#### TC-BIND-001 - Production add records the atomic pair

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-1, AC-F2-3, DM-1, DM-2, DM-3, G-2
**Evidence Class**: Permanent suite (revert-detecting: fails against the pre-fix producer)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts` over `tests/fixtures/queue/production/harness.ts`
**Tags**: @backend, @cli, @queue

**Preconditions**:

- A temporary checkout directory whose `.git/config` carries `[remote "origin"] url = https://github.com/owner/repo.git` and a valid `HEAD`; the path is unique per run.
- A temporary `HOME`/state root; `HARNESS_MODEL` and `HARNESS_SMALL_MODEL` set to synthetic values; a refusing credential port; a recording harness spawn runner.
- `createProductionComposer` is called with `cwd` = the checkout and `repositoryFacts: { originUrl: "https://github.com/owner/repo.git" }` **only** (no root is passed; the option type has no root member).

**Steps**:

1. Compose the production program and run `queue add GH-273 --json`.
2. Open the same state directory with a second `createStateStore` handle and call `readQueueEntries(store)`.
3. Locate the newest record for `GH-273`.
4. Replay the same invocation in a second harness over the same checkout and state root, then read the ledger again.

**Expected Outcome**:

- First run: exit 0, `data.result === "added"`.
- Exactly one queue entry record exists for `GH-273`; `record.repository === "github.com/owner/repo"` and `record.repositoryRoot` equals the absolute checkout directory created in the precondition.
- Both fields are present in the same record; no record with a single field exists anywhere in the ledger.
- Replay: exit 0, `data.result === "noop"`, and the stored pair is byte-equal to the first (`repository`, `repositoryRoot` unchanged).
- `data.entry.repository === "github.com/owner/repo"` (the key is projected); `repositoryRoot` is absent from `data`.

**Notes / Clarifications**:

- Pre-fix failure this test detects: `queue add` exits 1 with `error.code === "input.value.rejected"` and a summary containing `repository key and recorded root must be present together`; `readQueueEntries` shows zero records. The test asserts `exit === 0`, so it fails immediately.
- The harness API deliberately exposes no way to supply a root; if a future edit adds one, TC-BIND-015's "no partial composition" rule and this test's assertion against the real temp path both break.

#### TC-BIND-002 - Binding totality across the four-cell resolution matrix

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-2, AC-F1-3, DM-3, NFR-1, G-1
**Evidence Class**: Permanent suite; the key✗/root✓ cell is additionally mutation-verified (asymmetry mutation, §8.3 OQ-A)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @queue

**Preconditions**:

- Two checkout shapes: (i) a real temporary checkout with a `.git` directory (root resolves); (ii) a temporary directory created under the OS temp root **outside any git work tree** (root does not resolve). The harness asserts `findGitRoot(dir, nodeRepositoryIo()) === undefined` for shape (ii) before composing and fails loudly otherwise.
- Two origin shapes: (i) a normalizable GitHub origin; (ii) an origin that cannot be normalized (`https://gitlab.com/owner/repo.git`, plus a variant with `not-a-url`).

**Steps**:

1. For each of the four cells — key✓/root✓, key✓/root✗, key✗/root✓, key✗/root✗ — compose a fresh harness with the matching checkout and injected origin, run `queue add GH-273 --json`, then read the ledger entry.
2. Assert exit code, `data.result`, and the presence/absence of each repository field.
3. Count, across all four cells, the entries carrying exactly one of the two fields.

**Expected Outcome**:

- All four invocations exit 0 with `data.result === "added"`.
- key✓/root✓: both fields present.
- key✓/root✗: neither field present (no key-only record).
- key✗/root✓: neither field present (no root-only record).
- key✗/root✗: neither field present.
- One-sided binding count across the matrix is **0**.
- For any entry with no repository identity, the mutation projection reports `entry.state === "not-ready"` and blocking detail `repository-binding-unresolved` (the declared degraded state, not an error).

**Notes / Clarifications**:

- Pre-fix failure: key✓/root✓ is refused (exit 1, `input.value.rejected`) and key✓/root✗ is refused (the injected origin produces the key-only literal). key✗/root✓ and key✗/root✗ already succeed with no fields pre-fix.
- Because the pre-fix code already yields "absent" for the two key-unresolved cells, cell key✗/root✓ cannot fail against the reverted producer. PM-ratified (§8.3 OQ-A): it is a **symmetry guard**, proven by an in-place **asymmetry mutation** — make the derivation emit a root-only binding when the key is unresolved, confirm this cell fails, then restore. Both key-unresolved cells remain inside the permanent suite.
- The root-unresolved cell key✓/root✗ is the revert-detecting half required by AC-F6-1 and NFR-4 and is expected to fail against the pre-fix producer (key-only literal).
- Root-unresolved cells must run outside the repository work tree: the repo's own `.git` would otherwise be found by the ascending search.

#### TC-BIND-003 - Nested working directory records the checkout root

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-7, RSK-2
**Evidence Class**: Permanent suite (revert-detecting: fails against the pre-fix producer)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @queue

**Preconditions**:

- A temporary checkout whose working directory is a nested directory (`packages/core/src/deep` inside the checkout; directories created, `.git` only at the checkout root).
- Injected origin: the same remote written in the checkout's `.git/config`.

**Steps**:

1. Compose with `cwd` = the nested directory and run `queue add GH-273 --json`.
2. Read the ledger entry and compare `repositoryRoot` with the checkout root and with the nested directory.

**Expected Outcome**:

- Exit 0, `data.result === "added"`.
- `record.repositoryRoot` equals the absolute checkout root, and is **not** the nested working directory.
- `record.repository === "github.com/owner/repo"`.

**Notes / Clarifications**:

- Pre-fix failure: the add is refused (exit 1, `input.value.rejected`).
- This test is also the guard for a fix that reads the raw `cwd` instead of the resolved root: such a fix would record the nested directory path and fail the equality.

#### TC-BIND-004 - Linked worktree records its own root; top-level equals nested

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, NFR-7, DEC-2
**Evidence Class**: Permanent suite (revert-detecting: fails against the pre-fix producer)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @queue

**Preconditions**:

- A main checkout with `.git/config` (origin) and `.git/HEAD`.
- A linked-worktree directory whose `.git` is a **file** containing a `gitdir:` line pointing at the main checkout's `.git/worktrees/linked`, with `commondir` = `../..` in that worktree git directory and a `HEAD` file (the same on-disk shape used by `tests/behaviour/status-repository.test.ts`).
- The worktree's remote is read from the shared common directory config.

**Steps**:

1. Compose with `cwd` = the worktree root; run `queue add GH-273 --json`; read the entry.
2. In a second harness over a separate state root, compose with `cwd` = the main checkout top level; run `queue add GH-274 --json`; read the entry.
3. In a third harness, compose with `cwd` = a nested directory inside the main checkout; run `queue add GH-275 --json`; read the entry.

**Expected Outcome**:

- Worktree invocation: `repositoryRoot` equals the worktree root, and the worktree root differs from the main checkout root.
- Top-level and nested invocations of the same checkout record the **same absolute** `repositoryRoot`.
- All three record `repository === "github.com/owner/repo"` and exit 0.

**Notes / Clarifications**:

- Pre-fix failure: the worktree invocation is refused (exit 1, `input.value.rejected`), so the assertions never hold.
- A fix that resolves the root from the common directory instead of the worktree checkout would record the main checkout and fail the `!==` assertion.

#### TC-BIND-005 - Root is absolute and add performs no spawn or network call

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, NFR-5, NFR-8
**Evidence Class**: Permanent suite (runtime half of AC-F2-3; revert-detecting)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @queue, @purity

**Preconditions**:

- TC-BIND-001 harness, additionally injecting a `harnessSpawnRunner` that records every call and a `githubTransport` whose `send` records and throws, plus a `gitChildRunner` that records every call.
- An absolute `HOME` and `cwd`.

**Steps**:

1. Run `queue add GH-273 --json`.
2. Read the ledger entry.
3. Inspect the recorded counters for spawn, transport send, and git child calls.

**Expected Outcome**:

- `record.repositoryRoot` satisfies `isAbsolute(root) === true` and equals the checkout path.
- `harnessSpawnRunner` calls = 0, `githubTransport.send` calls = 0, `gitChildRunner` calls = 0.
- The entry is the only new state record kind appended (no extra record families).

**Notes / Clarifications**:

- Pre-fix failure: the add is refused, so there is no entry to inspect.
- "0 additional repository-facts resolution" is not observable from outside the composer (the adapter is a static import). PM-ratified (§8.3 OQ-D): the accepted observable proxy is this test's 0-spawn / 0-network assertions plus the structural single-resolution assertion in TC-BIND-016 (with the single-derivation-site invariant in TC-BIND-014); AC-F2-3 states the structural carry instead of an unobservable runtime counter.

#### TC-BIND-006 - Normalized key for every accepted remote form, mutually consistent

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-1, RSK-1, NFR-6
**Evidence Class**: Permanent suite (revert-detecting; also carries the binding-level determinism half of NFR-6)
**Test Type(s)**: Integration (plus pure normalizer rows)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`; remote-form rows sourced from `tests/fixtures/queue/graph/binding/cases.json`
**Tags**: @backend, @cli, @queue

**Preconditions**:

- For each accepted form, a fresh temporary checkout whose `.git/config` carries that form, and the **same** form injected as `repositoryFacts.originUrl` (so the recorded root's actual remote and the injected origin agree).
- Forms: `https://github.com/owner/repo.git`, `https://github.com/owner/repo`, `ssh://git@github.com/owner/repo`, `git@github.com:owner/repo.git`, and a mixed-case form such as `https://github.com/Owner/Repo.git`.

**Steps**:

1. For each form: compose, run `queue add GH-273 --json`, read the entry.
2. Assert the recorded key for every form is identical and lowercase `host/owner/name`.
3. Read the `.git/config` of the recorded root, extract the origin URL, and normalize it with the queue-world normalizer (`normalizeRepositoryKey`) that the queue fixtures and the deploy-expectation port use for exact equality; assert exact equality with `record.repository`.
4. Feed the same forms through `normalizeRepositoryKey` directly and assert the same key.

**Expected Outcome**:

- Every form records `repository === "github.com/owner/repo"` (no `Owner/Repo`, no host-less `owner/repo`).
- For every form, `normalizedRemote(recordedRoot) === record.repository` (mutual consistency).
- All invocations exit 0 with `data.result === "added"`.
- An unnormalizable/non-GitHub form is covered by TC-BIND-002 cell key✗ and records no binding, never a partial one.

**Notes / Clarifications**:

- Pre-fix failure: every form is refused (exit 1, `input.value.rejected`). A fix that adds only the root would record `Owner/Repo` or `owner/repo` and fail the exact-key and lowercase assertions — the RSK-1 quiet-mismatch shape.
- Writing the same form into `.git/config` and the injection is required for the consistency assertion to be meaningful; a fixture-supplied pair would make it vacuous.

#### TC-BIND-007 - Dispatch identity resolves from the recorded scheduler key

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-F4-2, DM-1, RSK-1
**Evidence Class**: Permanent suite (resolver unit assertion is the AC-F3-2 evidence; the end-to-end half covers AC-F4-2 only)
**Test Type(s)**: Integration + Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts` (integration), same file (unit assertion on `resolveDispatchIdentity`)
**Tags**: @backend, @cli, @dispatch

**Preconditions**:

- Harness A: checkout origin `https://github.com/owner/scheduler.git`; add `GH-273` through the production composition; no dispatch identity marker exists in the checkout's git common directory.
- The checkout's `.git/config` is then rewritten to `https://github.com/owner/remote.git`, and a second harness opens the same state root and checkout but injects the **new** remote (so scheduler key and remote disagree).

**Steps**:

1. Verify the ledger entry's `repository === "github.com/owner/scheduler"`.
2. Run `dispatch GH-273 --json` in the second harness with a recording spawn runner and a refusing credential port.
3. Read `readDispatchAttempts(store)` and the dispatch identity marker text from the checkout's git common directory.
4. Unit-assert `resolveDispatchIdentity({ schedulerKey: "github.com/owner/scheduler", remoteUrl: "https://github.com/owner/remote.git" })`.

**Expected Outcome**:

- Step 4 returns `{ ok: true, repository: "github.com/owner/scheduler", source: "scheduler" }` (the declared precedence, not `source: "remote"`).
- Step 3: the first attempt record's `repository === "github.com/owner/scheduler"`; the persisted marker serializes the scheduler key.
- `dispatch` does not fail with `queue.entry.unobserved`.

**Notes / Clarifications**:

- Pre-fix failure: the `queue add` in step 1 is refused, and (in the counterfactual where a host-less key were recorded) `normalizeDispatchRepositoryKey("owner/scheduler")` returns `undefined` because it has two segments, so resolution falls through to the remote and yields `github.com/owner/remote` with source `remote` — both the attempt and marker assertions fail.
- `source` is not projected into any envelope. PM-ratified (§8.3 OQ-E): AC-F3-2 is asserted directly here, at the resolver unit level, using the key the composition recorded and a disagreeing remote-derived identity; the end-to-end `dispatch` half of this scenario covers only AC-F4-2 (proceeding past the observation gate).

#### TC-BIND-008 - List observes the entry and no read surface leaks the root

**Scenario Type**: Happy Path + Negative (non-disclosure)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2, NFR-3, RSK-6
**Evidence Class**: Permanent suite (revert-detecting)
**Test Type(s)**: Integration + Structural (source allowlist)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`; source allowlist assertion in `tests/structure/queue-binding-derivation.test.ts`
**Tags**: @backend, @cli, @queue, @privacy

**Preconditions**:

- TC-BIND-001 harness with a known absolute checkout path (unique per run), plus a refusing credential port and recording spawn runner.
- The derived graph document path from the store identity (`queueGraphDocumentPath`).

**Steps**:

1. Run `queue add GH-273 --json`; read the ledger entry to obtain the exact root string.
2. Run `queue list --json` and `queue list` (text), `queue plan --json`, `lanes list --json`, `lanes show GH-273 --json`, `queue claim GH-273 --holder h --json`, `queue release GH-273 --holder h --json`, `status --json`, `brief --json`.
3. Read the derived graph document from disk.
4. Scan the structure test: enumerate every `repositoryRoot` reference under `packages/*/src/**/*.ts`.

**Expected Outcome**:

- `queue list --json`: `data.entries` contains `GH-273` with `repository === "github.com/owner/repo"`; no other entry fields carry the root.
- The exact root string occurs **zero** times in the stdout/stderr of every command in step 2 (JSON and text) and in the graph document bytes.
- Source scan: `repositoryRoot` occurs only in the allowlist `packages/cli/src/edge.ts`, `packages/cli/src/production.ts` (after the fix), `packages/core/src/app/queue.ts`, `packages/core/src/contracts/queue.ts`; any other file fails and is named in the assertion message.

**Notes / Clarifications**:

- Pre-fix failure: `queue list` is empty, so the entry assertion fails before the leak assertions.
- `status`/`brief` are asserted for **absence only**; their exit code is not asserted because the composition is deliberately credential-degraded. PM-ratified (§8.3 OQ-F): root absence is asserted on `queue list`, `status` **and** `brief` (JSON and text), with no exit-code assertions on the credential-degraded surfaces; the AC-F4-1 wording carries the same absence-only qualifier.
- The source allowlist is a proxy for "no new disclosure site", deliberately file-based (not line-based) and with a message naming the offending file; a legitimate new consumer (e.g. wiring the deploy-expectation port) updates it in review.
- NFR-3's "0 diffs outside the recorded entry" is review evidence plus the unchanged golden suites, not a new assertion.

#### TC-BIND-009 - Claim/plan observe and dispatch passes the observation gate

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, G-3, RSK-8
**Evidence Class**: Permanent suite (revert-detecting)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @dispatch

**Preconditions**:

- TC-BIND-001 harness (origin resolves, add succeeded), with `HARNESS_MODEL`/`HARNESS_SMALL_MODEL` set, a recording spawn runner that returns a completed session, and a refusing credential port (so no network).

**Steps**:

1. `queue plan --json`; assert the ref is observed.
2. `dispatch GH-273 --json`; capture exit, `data.result`, `error.code`, and the dispatch attempts.
3. Assert the attempt count and the attempt's repository.

**Expected Outcome**:

- `queue plan --json` data lists `GH-273` in `entries` (and/or `nextActions`) with `repository === "github.com/owner/repo"`.
- `dispatch` returns any **classified** outcome except `queue.entry.unobserved`; the refusal path is proven passed by exactly one appended attempt record (`readDispatchAttempts`).
- The attempt record's `repository` is the recorded scheduler key.
- The root string does not occur in the dispatch envelope.

**Notes / Clarifications**:

- Pre-fix failure: `dispatch` refuses with `queue.entry.unobserved` before any spawn and appends **zero** attempts — the attempt-count and error-code assertions both fail.
- `queue claim` is not used as the observation oracle because the production composition's queue facts are empty, so a claim may refuse for unrelated preconditions; the spec accepts `claim` **or** `plan`, and `plan` is the deterministic observation.

#### TC-BIND-010 - Ticket repro sequence: add → list → dispatch

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F6-4, AC-F1-1, AC-F4-2, G-3, RSK-8
**Evidence Class**: Permanent suite, with the pre-fix failure triple encoded explicitly (no reverted-code run)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @queue, @dispatch

**Preconditions**:

- One production harness over a real checkout with a resolvable GitHub origin (origin injected only), fresh state root.

**Steps**:

1. `queue add GH-273 --json` → assert `added`, exit 0, ledger pair recorded.
2. `queue list --json` → assert the entry is observed with the normalized key.
3. `dispatch GH-273 --json` → assert no `queue.entry.unobserved` and one attempt appended.
4. Compare the observed outcomes element-by-element against the encoded `PRE_FIX_FAILURE_TRIPLE` constant declared in the test file: `{ addRefusalCode: "input.value.rejected", entryCount: 0, dispatchErrorCode: "queue.entry.unobserved" }`.

**Expected Outcome**:

- All three invocations succeed in the fixed sense; the ledger contains the pair; the list shows the entry; dispatch passes the observation gate.
- Step 4: each observed value **differs** from its pre-fix expectation — the add did not refuse with `input.value.rejected`, the entry count is 1 (not the encoded 0), and the dispatch error code is not `queue.entry.unobserved`.

**Notes / Clarifications**:

- PM-ratified (§8.3 OQ-G): the pre-fix failure triple is encoded explicitly in this test as the `PRE_FIX_FAILURE_TRIPLE` constant plus an element-wise difference assertion, rather than requiring the test to run against reverted code. The triple is the ticket's evidence: refusal on add, zero entries on list, `queue.entry.unobserved` on dispatch.
- This is the AC-F6-4 repro chain; it intentionally overlaps TC-BIND-001/008/009 and is the end-to-end statement of the ticket. The revert evidence for the same paths is recorded separately by TC-BIND-018.

#### TC-BIND-011 - Domain refuses one-sided add requests (key-only, root-only)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F6-2, DM-1, DM-2, RSK-5
**Evidence Class**: Mutation-verified (write-side predicate mutation; cannot fail on a producer revert)
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-binding-invariant.test.ts` using `makeAuditStore` from `tests/fixtures/state/harness.ts`
**Tags**: @backend, @queue, @domain

**Preconditions**:

- A fresh in-memory/temp audit store; no entries.
- Production domain imports only (`declareQueueEntry`, `readQueueEntries`); **no domain code change**.

**Steps**:

1. Call `declareQueueEntry(store, { ref: "GH-273", repository: "github.com/owner/repo", recordedAt: NOW, fenceToken: "k1" })`.
2. Call `declareQueueEntry(store, { ref: "GH-274", repositoryRoot: "/work/checkout", recordedAt: NOW, fenceToken: "k2" })`.
3. Read the ledger record count after each call.

**Expected Outcome**:

- Both calls return `ok: false`, `kind: "input"`, `code: "input.value.rejected"`.
- Both details are exactly `repository key and recorded root must be present together`.
- The ledger record count is unchanged (0 appends) after each refusal.
- A control with both fields succeeds and appends one record with both fields.

**Notes / Clarifications**:

- This behaviour is unchanged by the fix, so it passes pre-fix. PM-ratified (§8.3 OQ-B): its adequacy is proven by **predicate mutation, not revert** — soften or delete the write-side mutual-presence branch (the `desiredEntry` predicate), run this suite, confirm both one-sided cases fail, then restore. The mutation and its red result are recorded in the change review; the test stays a permanent suite assertion.
- This is the "do not change domain code" guard: any diff to the predicate is visible in review.

#### TC-BIND-012 - One-sided stored record fails closed as a torn store

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, AC-F6-2, DEC-6
**Evidence Class**: Mutation-verified (read-side predicate mutation; cannot fail on a producer revert)
**Test Type(s)**: Unit + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-binding-invariant.test.ts` (domain read) and the queue edge harness in `tests/fixtures/queue/cli/harness.ts` (CLI projection)
**Tags**: @backend, @queue, @state

**Preconditions**:

- A temp store; a fenced append of a raw queue entry payload with `kind: QUEUE_ENTRY_RECORD_KIND`, `recordKey: queueEntryRecordKey("GH-273")`, `schema: QUEUE_ENTRY_SCHEMA`, valid `ref`, `priority`, `recordedAt`, and exactly **one** of `repository`/`repositoryRoot`.

**Steps**:

1. Append a key-only record; call `readQueueEntries(store)`.
2. Map the failed read onto `queue list --json` through the edge harness.
3. Repeat with a root-only record.
4. Assert no fallback entry is produced and the raw record is still in the ledger.

**Expected Outcome**:

- `readQueueEntries` returns `ok: false`, `reason: "torn"`, `code: "state.store.torn"` for both shapes.
- `queue list --json` exits 2 with `error.code === "state.store.torn"` and no `data`.
- The raw record remains readable in the ledger (nothing silently dropped) and no entry is fabricated from it.
- The store's read count is unchanged by the failed read.

**Notes / Clarifications**:

- Passes pre-fix (behaviour unchanged); it is the first explicit coverage of the read-side branch (AC-F6-2). PM-ratified (§8.3 OQ-B): verify with the **second** predicate mutation — delete the read-side mutual-presence predicate in `isEntryRecord`, run this suite, confirm both one-sided shapes fail (not silently become entries), then restore. Write-side and read-side mutations are applied one after the other so each layer's red result is attributable.
- Do not "fix" this by adding an error identity — DEC-6 and NG-6 forbid it.

#### TC-BIND-013 - Queue error identities and invariant branches unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, AC-F5-3, NFR-3, NG-1, NG-6
**Evidence Class**: Review-verified (diff-level inspection recorded in the change review) + existing pinned error-set suite
**Test Type(s)**: Structural (existing) + Manual review
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts` (TC-VOCAB-002), `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/golden/queue-*.test.ts`; plus the review verdict
**Tags**: @backend, @docs, @review

**Preconditions**:

- The change branch with the producer fix and fixture correction applied.

**Steps**:

1. Run the existing error-table and queue-vocabulary suites; confirm `[...QUEUE_ERROR_CODES]` still equals the pinned `tests/fixtures/queue/errors/references.json` `queueRows` and the documented error table still matches.
2. Run the queue golden suites (`queue-list`, `queue-plan`, `queue-rank`, `queue-lease-conflict`) and confirm byte-identical goldens.
3. In review, inspect the diff of `packages/core/src/app/queue.ts` (both invariant predicates) and `packages/core/src/contracts/error-table.ts`.

**Expected Outcome**:

- Automated: no added/retired queue error row, no schema/record-kind change, goldens unchanged.
- Review: `desiredEntry`'s mutual-presence branch and `isEntryRecord`'s branch are byte-unchanged (no condition softened, removed, or made asymmetric).
- Recorded evidence: suite output plus a review note quoting the unchanged predicates.

**Notes / Clarifications**:

- PM-ratified (§8.3 OQ-E): AC-F5-3 is **review-verified**. The diff-level evidence (unchanged error table, unchanged invariant predicates) is recorded in the change review, and the existing pinned error-set test supplies the automated half. The repository testing strategy forbids permanent suites that assert a diff against a moving base, so no new permanent test is created here.

#### TC-BIND-014 - Exactly one derivation site, never a partial binding literal

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-4, NFR-4, RSK-3
**Evidence Class**: Permanent suite (structural; revert-detecting via the partial-literal assertion)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-binding-derivation.test.ts` (TypeScript AST via the `typescript` dev dependency already used by `tests/structure/queue-scheduling-contract.test.ts`)
**Tags**: @backend, @structure, @queue

**Preconditions**:

- Source tree at the change branch.

**Steps**:

1. Parse every `packages/cli/src/**/*.ts` file and collect `PropertyAssignment` nodes named `repositoryBinding`.
2. Exclude the type declaration member in `edge.ts` and the read/forward expressions (non-construction contexts) by AST context, not by line number.
3. Assert exactly one construction site (in `production.ts`) that feeds a queue composition.
4. Assert that no `repositoryBinding` initializer in that set is an `ObjectLiteralExpression` containing exactly one of `repository`/`repositoryRoot`.
5. Assert the queue composition is constructed once: the `queue` option of `createConfigProgram` receives the same object as `lanes`.

**Expected Outcome**:

- Exactly one construction site exists in `packages/cli/src`.
- No partial literal exists anywhere in `packages/cli/src` (both keys or a non-literal reference).
- The failure message names the file and the offending property so a future author knows the rule.

**Notes / Clarifications**:

- Pre-fix failure: the single construction site (pre-fix `production.ts`) is an object literal with only `repository`; the partial-literal assertion fails. A naive "count === 1" check would pass pre-fix, which is why the shape assertion is part of the same test.
- Brittleness controls: AST not text (comments/strings cannot trigger it), no line numbers, no hardcoded variable names, and the invariants are the two the spec states. A legitimate second producer, or a second composition, fails deliberately and requires an explicit update — that is the anti-recurrence intent (spec §22).
- Only `packages/cli/src` is scanned; fixtures and MCP are out of scope for AC-F1-4.

#### TC-BIND-015 - Fixture shape: both fields or none; pilot key matches seeds

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6, AC-F6-3, DEC-7, G-4, RSK-7
**Evidence Class**: Permanent suite (structural; revert-detecting: the pre-fix pilot binding is one-sided)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-binding-fixture-shape.test.ts`; AST scan of `tests/fixtures/**/*.ts`
**Tags**: @backend, @structure, @fixtures

**Preconditions**:

- The fixture correction (`tests/fixtures/pilot/harness.ts` binding becomes a pair) applied in the same change.

**Steps**:

1. Parse every `tests/fixtures/**/*.ts` file; collect `repositoryBinding` property assignments.
2. For each: require an object literal with **both** keys, or an identifier reference to a same-file declaration that is such a literal. Fail with the file name otherwise.
3. For the pilot harness, extract the `repository` initializer and the `repository` initializer used when seeding queue entries; assert both are the same identifier (`PILOT_REPOSITORY`).
4. At runtime, compose the pilot fixture and read its seeded entries via `readQueueEntries(pilot.store)`; assert every seeded `repository === PILOT_REPOSITORY` and that each seeded record carries both fields.

**Expected Outcome**:

- Zero fixtures compose a one-sided binding.
- The pilot binding key and the pilot ledger seeds use the same value.
- `tests/fixtures/queue/cli/harness.ts` default pair remains a pair.
- The assertion message names the offending fixture file.

**Notes / Clarifications**:

- Pre-fix failure: the pilot harness composes `{ repository: PILOT_REPOSITORY }` (one field), so step 2 fails; the queue CLI harness passes.
- Brittleness controls: shape assertion (both-or-none), not exact path strings; identifier comparison instead of a literal comparison where possible; the pilot's synthetic key domain is **not** normalized here (deferred by DEC-7); if the binding becomes a variable, the identifier-declaration rule prevents a silent pass.
- Do not reconcile pilot goldens: the binding is unused because the pilot never calls `queue add` (RSK-7).

#### TC-BIND-016 - One repository-facts resolution per composition

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-3, NFR-5
**Evidence Class**: Permanent suite (structural) + mutation-verified (add a second resolution call, confirm red)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-binding-derivation.test.ts`
**Tags**: @backend, @structure, @queue

**Preconditions**:

- Source tree at the change branch.

**Steps**:

1. Parse `packages/cli/src/production.ts`; count `CallExpression` nodes whose callee identifier is `readRepositoryFacts`.
2. Assert the count is exactly 1.
3. Assert the queue composition builder does not call `readRepositoryFacts` or `findGitRoot` a second time (no second call in the file).

**Expected Outcome**:

- Exactly one repository-facts resolution in the production composition.
- Failure message names the extra call site's enclosing function.

**Notes / Clarifications**:

- This passes pre-fix and post-fix; it is an anti-recurrence guard so the fix cannot "solve" the root by adding a second read (NFR-5/NFR-8: 0 additional git reads). PM-ratified (§8.3 OQ-D): this structural assertion is the accepted carry for the "no additional repository-facts resolution" half of AC-F2-3, in place of an unobservable runtime counter. Its detection is mutation-verified by inserting a second `readRepositoryFacts` call and confirming the suite fails.
- Runtime purity (0 spawns, 0 outbound calls) is the observable half, asserted in TC-BIND-005.

#### TC-BIND-017 - Binding determinism across replays

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6, DM-3
**Evidence Class**: Permanent suite (binding-level determinism only)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-production-binding.test.ts`
**Tags**: @backend, @cli, @queue, @determinism

**Preconditions**:

- Two independent production harnesses over the **same** checkout and the same injected origin, each with its own fresh state root.

**Steps**:

1. In harness A, add `GH-273`; in harness B, add `GH-273`.
2. Compare the recorded `repository` and `repositoryRoot` from both ledgers.
3. Replay the add in harness A and compare the stored pair again.

**Expected Outcome**:

- Both harnesses record the identical `repository` and `repositoryRoot` strings.
- The replay is `noop` and leaves the pair unchanged.
- No environment variable, clock, or random value affects the binding.

**Notes / Clarifications**:

- Pre-fix failure: both adds are refused (`input.value.rejected`), so no pair exists to compare.
- PM-ratified (§8.3 OQ-C): determinism is **binding-level** — the same checkout (same key and root) yields the same `repository`/`repositoryRoot` under identical facts and arguments. Byte-identical replay of the wall-clock-derived production envelope (`recordedAt`) is explicitly out of scope for this change; envelope-shape stability remains covered by the unchanged golden suites.

#### TC-BIND-018 - Pre-fix failure verification by in-place revert and asymmetry mutation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-4
**Evidence Class**: Review-verified (revert and mutation procedure; evidence recorded in the change review and §10)
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Execution procedure (no committed test); evidence recorded in the review verdict and §10
**Tags**: @review, @regression

**Preconditions**:

- Green new suites on the fixed tree.
- A clean working tree (or a scratch commit) so the producer derivation and the invariant predicates can be mutated and restored safely; never run this in CI.
- The three AC-F6-1 evidence paths are distinguished up front: **composition add** (revert-detecting), **root-unresolved guard** (revert-detecting), **key-unresolved guard** (symmetry guard, mutation-detected).

**Steps**:

1. Run the new behaviour and structural suites on the fixed tree; record the pass.
2. **Revert check — changed-behaviour layer.** Revert **only** the producer derivation in `packages/cli/src/production.ts` (leave the new tests and fixtures in place).
3. Re-run:
   - `bun test tests/behaviour/queue-production-binding.test.ts`
   - `bun test tests/behaviour/queue-binding-invariant.test.ts`
   - `bun test tests/structure/queue-binding-fixture-shape.test.ts`
   - `bun test tests/structure/queue-binding-derivation.test.ts`
4. Record which TCs fail and with what message. Expect the **composition add** path (TC-BIND-001 and its repro chain TC-BIND-010, plus TC-BIND-003/004/005/006/007/008/009/017) and the **root-unresolved guard** (TC-BIND-002, cell key✓/root✗) to fail, along with TC-BIND-014 and TC-BIND-015.
5. Restore the producer change; re-run and confirm green.
6. **Asymmetry mutation — key-unresolved symmetry guard.** With the fix in place, mutate the derivation so that an unresolved key combined with a resolved root emits a `repositoryBinding` carrying only `repositoryRoot` (re-introducing an asymmetric guard that produces a root-only binding).
7. Re-run the focused cell: `bun test tests/behaviour/queue-production-binding.test.ts -t "TC-BIND-002"`.
8. Record that **exactly** the key✗/root✓ cell fails, with the assertion naming a root-only binding (`repositoryRoot` present, `repository` absent). The other three cells must stay green. Restore the derivation and confirm green.
9. **Predicate mutations — domain negatives (AC-F6-2).** Apply the write-side mutation first (soften or delete the mutual-presence branch in the `desiredEntry` predicate), run `bun test tests/behaviour/queue-binding-invariant.test.ts`, record that TC-BIND-011 fails, and restore; then apply the read-side mutation (delete the read-side mutual-presence predicate in `isEntryRecord`), record that TC-BIND-012 fails, and restore.
10. Record every mutation, its red set, and the post-restore green run in the review verdict and §10.

**Expected Outcome**:

- Revert failures are confined to the changed-behaviour layers: the composition add test (TC-BIND-001 with TC-BIND-010 and the other composition tests) and the **root-unresolved guard** (TC-BIND-002 cell key✓/root✗), plus TC-BIND-014 (partial literal) and TC-BIND-015 (pilot one-sided binding).
- Explicitly **not** expected to fail on revert: TC-BIND-002 cell key✗/root✓ (the key-unresolved symmetry guard), cell key✗/root✗, TC-BIND-011, TC-BIND-012, TC-BIND-013, TC-BIND-016 — these already hold pre-fix.
- Asymmetry mutation: the key✗/root✓ cell fails with a root-only-binding message and no other cell fails; this is the detection evidence for AC-F1-2/AC-F6-1.
- Predicate mutations: write side → TC-BIND-011 red only; read side → TC-BIND-012 red only.
- After each restore: all green again.

**Notes / Clarifications**:

- This is deliberately not a permanent suite: a test that rewrites source during its run is unsafe and would violate test isolation. It is a review gate, not an automated check.
- PM-ratified (§8.3 OQ-A, OQ-B): revert is the evidence for the composition add test and the root-unresolved guard only; the key-unresolved guard is proven by the in-place asymmetry mutation in steps 6–8, and the domain negatives by the write-side-then-read-side predicate mutations in step 9.

## 6. Environments and Test Data

- **Runtime**: local Linux/macOS developer machine or CI, Bun per `.bun-version`, `bun test` / `pnpm test`; no network, no provider credentials, no model process, no daemon.
- **Temp layout**: every harness creates a unique `minimal HOME` and state root with `mkdtempSync`; cleanup in `finally` with `rmSync(recursive, force)`. Checkout trees are created under the repo-local `tmp/tmpdir` tree for parity with the existing composition suites, **except** the root-unresolved cell, which must be created under the OS temp root (`tmpdir()`) so `findGitRoot` cannot ascend into this repository's own `.git`. The harness asserts `findGitRoot(...) === undefined` before composing that cell and throws a clear message if the environment violates it.
- **Git metadata**: fabricated on disk (`.git/config` with the origin, `.git/HEAD`, and for a linked worktree a `.git` file plus `commondir`/`HEAD` under a `worktrees` directory). No `git` binary is spawned by the new suites; this mirrors `tests/behaviour/status-repository.test.ts`.
- **Injection discipline**: `ProductionCompositionFacts.repositoryFacts` is supplied with `{ originUrl }` only. The `cwd` is a real directory with real metadata, so the root is always derived by the production code. No fixture accepts or supplies a root. The origin written into `.git/config` and the injected origin are the same string whenever mutual consistency is asserted.
- **State**: each harness owns its own state directory; the test opens a second `createStateStore` handle against the same directory only to read the ledger. No writes to the live repo, the real user state directory, or any shared resource.
- **Fixtures**:
  - New harness: `tests/fixtures/queue/production/harness.ts` — builds home/state/checkout variants, composes the production program, exposes `run`, `store`, `ledgerEntries()`, `checkout`, `spawns`, `transportCalls`, `dispose()`.
  - Reused: `tests/fixtures/state/harness.ts` (`makeAuditStore`), `tests/fixtures/queue/cli/harness.ts` (edge-level list projection), `tests/fixtures/queue/schedule/harness.ts` (repo constants), `tests/fixtures/queue/graph/binding/cases.json` (remote forms), `tests/fixtures/pilot/harness.ts` (corrected pair).
  - Fixture files are never named `*.test.ts`.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Implementation status | Evidence class | Execution command |
|-------|-----------|-----------------------|----------------|-------------------|
| TC-BIND-001 | `tests/behaviour/queue-production-binding.test.ts` | To Implement | Permanent suite | `bun test tests/behaviour/queue-production-binding.test.ts` |
| TC-BIND-002 | same | To Implement | Permanent suite; key✗/root✓ cell mutation-verified | same |
| TC-BIND-003 | same | To Implement | Permanent suite | same |
| TC-BIND-004 | same | To Implement | Permanent suite | same |
| TC-BIND-005 | same | To Implement | Permanent suite | same |
| TC-BIND-006 | same | To Implement | Permanent suite | same |
| TC-BIND-007 | same | To Implement | Permanent suite (resolver unit assertion) | same |
| TC-BIND-008 | same + `tests/structure/queue-binding-derivation.test.ts` (source allowlist) | To Implement | Permanent suite | same + `bun test tests/structure/queue-binding-derivation.test.ts` |
| TC-BIND-009 | `tests/behaviour/queue-production-binding.test.ts` | To Implement | Permanent suite | same |
| TC-BIND-010 | same | To Implement | Permanent suite (encoded pre-fix triple) | same |
| TC-BIND-011 | `tests/behaviour/queue-binding-invariant.test.ts` | To Implement | Mutation-verified (write side) | `bun test tests/behaviour/queue-binding-invariant.test.ts` |
| TC-BIND-012 | same | To Implement | Mutation-verified (read side) | same |
| TC-BIND-013 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/golden/queue-*.test.ts` | Existing – No Change | Review-verified (+ pinned suite) | `bun test tests/structure/queue-scheduling-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/golden` |
| TC-BIND-014 | `tests/structure/queue-binding-derivation.test.ts` | To Implement | Permanent suite (structural) | `bun test tests/structure/queue-binding-derivation.test.ts` |
| TC-BIND-015 | `tests/structure/queue-binding-fixture-shape.test.ts` | To Implement | Permanent suite (structural) | `bun test tests/structure/queue-binding-fixture-shape.test.ts` |
| TC-BIND-016 | `tests/structure/queue-binding-derivation.test.ts` | To Implement | Permanent suite (structural) + mutation-verified | same as TC-BIND-014 |
| TC-BIND-017 | `tests/behaviour/queue-production-binding.test.ts` | To Implement | Permanent suite (binding-level determinism) | same as TC-BIND-001 |
| TC-BIND-018 | none (manual) | Manual Only | Review-verified (revert + mutations) | `bun test tests/behaviour/queue-production-binding.test.ts` under a temporary producer revert; then the asymmetry mutation and the two predicate mutations |

Supporting changes (not test cases):

- `tests/fixtures/queue/production/harness.ts` — new fixture harness; must expose no way to pass a `repositoryRoot`.
- `tests/fixtures/pilot/harness.ts` — the queue composition binding becomes `{ repository: PILOT_REPOSITORY, repositoryRoot: \`/pilot/${PILOT_REPOSITORY}\` }`, matching the seeds (DEC-7). No golden regeneration expected because the pilot does not call `queue add`.
- `packages/cli/src/production.ts` — the producer fix under test (single total derivation; injected origin replaces only the remote).

Mocking requirements per TC: only seams already declared by `ProductionCompositionFacts` (origin remote, credentials, harness spawn runner, GitHub transport, git child runner) plus the store path. No module mocking, no `bun:test` `mock.module`, no monkey-patching of the adapters.

Focused verification while iterating:

```
bun test tests/behaviour/queue-production-binding.test.ts -t "TC-BIND-001"
bun test tests/behaviour/queue-binding-invariant.test.ts
bun test tests/structure/queue-binding-derivation.test.ts
bun test tests/structure/queue-binding-fixture-shape.test.ts
bun test tests/behaviour/queue-cli.test.ts tests/behaviour/queue-edge-wiring.test.ts tests/structure/dispatch-composition.test.ts
```

Final verification: `pnpm check` (lint → format:check → typecheck → test → check:boundaries) plus `git diff --check`. Pilot conformance suites (`tests/conformance/pilot`, `tests/checks/pilot-privacy.test.ts`) must pass unchanged.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| TR-1 | False green: a composition test injects facts and never executes the root path (spec RSK-4). | The harness accepts only `originUrl`; `cwd` is a real directory with real `.git` metadata; the expected root is the unique temp path. Nested/worktree tests fail if the root is taken from anywhere else. |
| TR-2 | A test passes because the fixture supplies the pair (spec success metric: 0 such tests). | No new fixture exposes a binding; the only `repositoryBinding` fixtures are the pre-existing edge harness (unchanged) and the corrected pilot (asserted by TC-BIND-015). Production tests read the pair from the ledger written by the real composition. |
| TR-3 | Structural assertions rot (line numbers, renamed identifiers). | AST-based, file-scoped, message-naming; assertion set limited to invariants the spec states; a second producer fails deliberately. |
| TR-4 | Root-unresolved cell accidentally sees the repository's own `.git`. | Cell uses the OS temp root and pre-asserts `findGitRoot === undefined`; a clear failure message tells the implementer why. |
| TR-5 | status/brief matrix is non-hermetic or slow. | Absence-only assertions, credential refusal + recording transport, no exit-code assertions; if a surface proves non-hermetic, report a gap rather than dropping it. |
| TR-6 | Pilot fixture correction churns unrelated conformance goldens (spec RSK-7). | The binding is unused (pilot does not `queue add`); TC-BIND-015 asserts shape only; no golden regeneration unless a suite fails, and then only with explicit review. |
| TR-7 | Reviewer cannot reproduce the pre-fix failure for tests that already pass pre-fix. | TC-BIND-018 lists the expected pass/fail matrix; §8.3 lists the exact asymmetry/predicate mutations for those layers. |

### 8.2 Assumptions

- The resolved repository facts expose the checkout root, absolute when `cwd` is absolute, and production passes an absolute `cwd` (spec §12).
- The production composition can be built over a fabricated `.git` directory without a real `git` binary, as the existing composition suites already do.
- `queue plan --json` lists all entries (bounded) regardless of readiness, so it can serve as the observation oracle for AC-F4-2.
- The recorded root is not projected by any current surface; only the entry record and the deploy-expectation resolver read it.
- The pilot fixture does not exercise `queue add`; its synthetic key domain therefore needs no normalization in this change.
- The production composition under test writes no audit or telemetry record beyond the queue entry: audit emission belongs to the entrypoint dependency set, which the harness does not compose. NFR-2's telemetry clause is therefore covered by the source allowlist (TC-BIND-008) plus the existing audit and envelope contract suites, not by a new runtime assertion.
- The four-cell matrix plus nested/worktree cases is sufficient evidence for totality; a generative property test is deferred per spec §7.3.

### 8.3 Resolved Questions and Resulting Test Obligations

All seven items below were arbitrated by the PM after spec v1.1. Each is recorded as **RESOLVED** with the ruling and the test obligation it creates; none blocks implementation.

| ID | Question | PM ruling (RESOLVED) | Resulting test obligation |
|----|----------|----------------------|---------------------------|
| OQ-A | AC-F1-2 (key unresolved, root resolved) cannot fail against the pre-fix code: the pre-fix composition already emits no binding when the target is unresolvable. AC-F6-1's "both guard-branch tests fail" is therefore not literally achievable. | **RESOLVED.** AC-F6-1 now requires revert-failure only for the **composition add test** and the **root-unresolved guard**. The key-unresolved guard is a **symmetry guard**, proven by an in-place asymmetry mutation rather than by revert. | TC-BIND-002 keeps all four cells in the permanent suite. Cell key✓/root✗ (AC-F1-3) is the revert-detecting root-unresolved guard. Cell key✗/root✓ (AC-F1-2) is proven by TC-BIND-018 steps 6–8: mutate the derivation to emit a **root-only** binding when the key is unresolved, run `-t "TC-BIND-002"`, observe **exactly** the key✗/root✓ cell fail with a root-only-binding message, restore. |
| OQ-B | NFR-4 requires "1 in-place revert check per layer (…, domain negative, …)", but the domain negative tests assert **unchanged** behaviour and cannot fail on a producer revert. | **RESOLVED.** Domain negatives are proven by **predicate mutation**, not revert: the write-side branch first, then the read-side branch. | TC-BIND-011 must turn red when the write-side mutual-presence branch (`desiredEntry`) is softened or deleted. TC-BIND-012 must turn red when the read-side mutual-presence predicate (`isEntryRecord`) is deleted. One mutation at a time, each restored, each red run recorded in the review (TC-BIND-018 step 9). NFR-4's threshold is restated as one predicate mutation per domain-negative layer. |
| OQ-C | NFR-6 asks for byte-identical replay, but the production composition uses the wall clock, so envelope bytes differ (`recordedAt`). | **RESOLVED.** Determinism is **binding-level** for the same checkout (same key and root); byte-identical wall-clock replay is out of scope for this change. | TC-BIND-017 asserts identical `repository`/`repositoryRoot` across two independent harnesses over the same checkout and across replay; it makes **no** envelope-byte comparison and introduces no clock seam. TC-BIND-006 carries the cross-form consistency half. Envelope-shape stability stays with the unchanged golden suites. |
| OQ-D | AC-F2-3 / NFR-5 require "no additional repository-facts resolution", which is not observable from outside the composer without a new seam. | **RESOLVED.** The observable proxy is accepted: **0 process spawns** and **0 network calls** on add, plus the **structural single-resolution assertion**. | TC-BIND-005 asserts the runtime counters (spawn runner, transport `send`, git child runner all zero). TC-BIND-016 asserts exactly one `readRepositoryFacts` call and no second `findGitRoot` in the production composition. TC-BIND-014 keeps the single-derivation-site invariant. No new seam is added and no behavioural claim is made beyond the proxy; AC-F2-3 states the structural carry. |
| OQ-E | AC-F5-3 and NFR-3 include "verified in review as a diff-level assertion" and "0 diffs outside the recorded entry". AC-F3-2's `source: scheduler` is not projected into any envelope. | **RESOLVED.** AC-F5-3 is **review-verified**: diff-level evidence recorded in the change review plus the existing pinned error-set test. AC-F3-2 is asserted **directly at the resolver unit level**; the end-to-end path covers only AC-F4-2. | TC-BIND-013 keeps the pinned suite automated and records the unchanged error table and both unchanged invariant predicates in the review verdict; no permanent test asserts a diff against a moving base. TC-BIND-007 asserts `{ repository: <scheduler key>, source: "scheduler" }` through a direct `resolveDispatchIdentity` call, and its integration half is scoped to AC-F4-2 (proceeding past the observation gate). |
| OQ-F | NFR-2 lists `status` and `brief` among surfaces that must not leak the root. | **RESOLVED.** Root absence is asserted on `queue list`, `status` **and** `brief`; **no exit-code assertions** on the credential-degraded surfaces. | TC-BIND-008 asserts the exact root string occurs zero times in `queue list`/`plan`, `lanes`, `claim`/`release`, `status` and `brief` output (JSON and text) and in the graph document, and asserts no exit code for `status`/`brief`. TC-BIND-009 asserts root absence in the dispatch envelope. If a surface proves non-hermetic, report a gap rather than dropping it (TR-5). |
| OQ-G | AC-F6-4 expects the pre-fix expectations "encoded as the failure the tests detect". | **RESOLVED.** AC-F6-4 may encode the pre-fix failure triple explicitly — refusal on add, zero entries on list, `queue.entry.unobserved` on dispatch — instead of running reverted code. | TC-BIND-010 declares a `PRE_FIX_FAILURE_TRIPLE` constant with those three values and asserts each observed outcome **differs** from it element-by-element (step 4). Revert evidence for the same paths stays with TC-BIND-018; the two are complementary, not duplicated. |

No item remains open; OQ-A/B/C/D/E/F/G are reflected in the spec v1.1 §17 acceptance criteria and in the TC rows named above.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1 | 2026-11-08 | @test-plan-writer | Initial test plan for GH-273. |
| 2 | 2026-11-08 | @test-plan-writer | Aligned with spec v1.1 §17 "Verification method": added an evidence class to every TC and to the coverage matrix; recorded PM rulings for OQ-A…OQ-G as RESOLVED in §8.3; re-specified TC-BIND-018 (revert for composition add + root-unresolved guard, asymmetry mutation for the key-unresolved guard, predicate mutations for domain negatives); re-specified TC-BIND-010 to encode the pre-fix failure triple; narrowed TC-BIND-017 to binding-level determinism; scoped TC-BIND-007's end-to-end half to AC-F4-2. No scope change. |

## 10. Test Execution Log

Populated during delivery/review. Record the four focused files, the regression suite set, the aggregate gate, the informational wall-clock per file, and the TC-BIND-018 evidence: the producer-revert failure set, the key-unresolved asymmetry mutation result, and the two domain predicate mutation results.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not run | Pending delivery |
