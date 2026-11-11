---
id: chg-GH-288-test-plan
status: Updated
created: 2026-11-11
last_updated: 2026-11-11T14:30:00Z
owners: [engineering]
service: delivery-os
labels: [feature, projects, state-layer, cli-composition, m2-s11, multi-repository]
version_impact: minor
summary: "Prove that two checkouts of different repositories on one host hold disjoint delivery state for the same ref, that `projects list [--json]` discovers them with no hand-written registry and reports only derived truth (state location, honest daemon degradation, evidence-only handover state), that one state-scope policy serves every store-opening surface, and that the one-step migration is a byte-identical, reversible move."
links:
  change_spec: ./chg-GH-288-spec.md
  implementation_plan: ./chg-GH-288-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Scope delivery state per repository and add the projects host overview

## 1. Scope and Objectives

This plan protects one property with several faces: **a delivery-managed checkout resolves exactly one state root, that root is derived from the checkout identity rather than from the user, and every surface that opens a store or derives a state path resolves the same root**. The failure this prevents is not cosmetic. Today the production composition opens one store for the whole host with workspace identifier `default`, while phase documents (`phase-state.<REF>.json`) and queue entries (`queue.entries:<REF>`) are keyed by ref alone, so two repositories working the same ref read and write each other's records; a single collision can advance an unrelated change's phase state or re-key another repository's lease. Two second-order risks are equally load-bearing and are tested as first-class behaviour rather than as documentation: an honest `projects list` that never invents a daemon or a handover authority it cannot derive, and a migration that moves bytes rather than rewriting records, so the audit chain and the retro sidecar survive.

The plan's central discipline is that **the headline isolation evidence is produced by real temporary git repositories** (`mkdtemp` + `git init`, two distinct git common directories, both working the real ref `GH-241`) through the real production composition. A synthetic in-memory store pair is not sufficient: the identity input under test is the checkout's git metadata, and only a real checkout proves the derivation. The complementary discipline is that **no test may reach the real user state directory**; every suite points the host root at a per-test temporary root and a fixture guard rejects the live workspace root and the real home-derived state directory before anything is written.

### 1.1 In Scope

- Two-checkout, same-ref isolation at the store level and at every read surface (`phase`, `queue`, `lanes`, `status`, `dispatch`).
- Project identity stability: nested invocation, linked worktree, rename, move, second clone of one remote, nested repository, and the declared host-scoped `unbound` scope outside any work tree (`AC-F1-5`).
- The state-scope override honouring: the host root is the delivered override-aware rule (`<PREFIX>_STATE_DIR` when absolute, otherwise home plus brand), and every derivation site — the production store, the MCP store, and the runtime-aware edge's audit store — resolves under it (`AC-F6-1`).
- The checkout identity marker discipline: created once, atomic, `0600`, never rewritten, no hardcoded name.
- The derived host index: absent ≠ corrupt, first-run success, corrupt-file preservation, bounded maintenance, provably-dead pruning that never touches state, monotonic revision, and state locations always re-derived.
- The `projects list [--json]` contract: exact envelope fields, ordering, deterministic text table, exit-code matrix, and the three new error identities.
- Handover projection across all eight concrete cells of the five-row truth table (spec §6 Flow 5 / Appendix B), including `in-transition` in both directions and a malformed derived view.
- Daemon reachability in both branches: the unmounted shipped build (declared reason, no probe) and a mounted composition with a real local unix socket (reachable, `socket-absent`, `socket-unreachable`, `state-absent`) under a bounded, write-free probe.
- One state-scope policy consumed by the CLI composition, MCP serve, daemon socket derivation, dispatch state root, retro sidecar, owner-hold read, and the CLI-independent bash fallback.
- Host-wide owner-hold continuity across project scoping and across migration.
- Migration: byte-identical move of the full store artifact set, audit-chain verification, retro sidecar readability, host-root emptiness afterwards, the inverse move, and the legacy-detection warning.
- Mount and documentation obligations: prompt-required membership, help entries, reference page registration, help-coverage and reference-page parity gates, three error-table rows under one new domain kind, no new hardcoded literal.
- System-spec and planning-corpus reconciliation (review-verified), and the release changeset shape.
- Test isolation itself: the guard, the leak detector, and the gate battery run under a repo-local `TMPDIR`.

### 1.2 Out of Scope & Known Gaps

- **No new suite for the state layer's own contract.** NFR-2 is asserted by the existing state/audit/retro suites staying green **unmodified**, plus a review-verified diff; this plan adds no new state-contract test (spec NG-1, §7.2 [OUT]).
- **No per-project owner holds, no `projects` verb beyond `list`, no re-attribution of historical records, no filesystem crawl for checkouts** (spec NG-5, NG-6, NG-7). The `unbound` scope is covered by `AC-F1-5` (added in spec v1.1); its behaviour is asserted by TC-PROJ-005 as that criterion's owning test.
- **No mount of the resident daemon lifecycle family.** The unmounted branch is asserted; making the probe live in the shipped build is another story (spec NG-4, §7.3).
- **No new performance tooling.** NFR-4 is measured with a bounded assertion suite plus recorded wall-clock, not a benchmark harness (mirrors the delivered GH-273 precedent).
- **`AC-F8-3`, `AC-F10-1`, `AC-F10-2` and the diff-level halves of `AC-F9-2`, `AC-F9-3`, `AC-F10-3` are review-verified.** No permanent suite asserts a diff against a moving base branch (`.ai/rules/testing-strategy.md` §"Invariant-test authoring"); the tree-invariant halves are automated and the diff halves are recorded in the change review and §10.
- **The 200-project latency cell uses seeded index rows, not 200 real checkouts.** Creating 200 real repositories would add minutes to the gate for no new code path; the read path under measurement is index-driven, and the real-checkout path is already exercised at 2 projects (TC-PROJ-001/002/007) and 25 (TC-PROJ-037). The seeded cell asserts the reported revision equals the seeded revision, so it cannot pass while silently ignoring the index.
- **`git` binary is required** by the identity, isolation, worktree and migration suites (spec §12 assumption). A missing `git` fails those suites loudly rather than skipping them; see risk TR-2.
- **MCP parity is asserted in-process**, not over a transport; the MCP surface's wire protocol is unchanged by this change and stays with the existing MCP suites.

## 2. References

- Change specification: [chg-GH-288-spec.md](./chg-GH-288-spec.md) (v1.1) — F-1…F-10, AC-F1-1…AC-F10-3 (35 criteria, including AC-F1-5 for the `unbound` scope), DM-1…DM-7, NFR-1…NFR-11, DEC-1…DEC-16 (DEC-16 names what a `projects.identity-unreadable` refusal discloses), Appendix A (state-scope matrix), Appendix B (handover matrix), Appendix C (daemon reason vocabulary), Appendix D (evidence map), Appendix E (scenario reconciliation).
- Implementation plan: [chg-GH-288-plan.yaml](./chg-GH-288-plan.yaml) — **produced in phase 4**; this test plan is its input, and the TC ids below are grouped so the plan's phases cite them directly (§7).
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, invariant-test authoring rules, gate battery.
- TypeScript workspace rules: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict-TS, purity, ports/adapters, bun:test authoring.
- M2 milestone pack: [architecture §"Multi-repository overview"](../../../planning/oss-tooling/milestones/m2/architecture.md), [contracts `projects.v1`](../../../planning/oss-tooling/milestones/m2/contracts.md), [command page `projects`](../../../planning/oss-tooling/milestones/m2/commands/projects.md), [test scenarios §M2-S11](../../../planning/oss-tooling/milestones/m2/test-scenarios.md).
- System specs to reconcile and to respect as current truth: [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [feature-cli-entrypoint.md](../../../spec/features/feature-cli-entrypoint.md), [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md), [feature-dispatch-engine.md](../../../spec/features/feature-dispatch-engine.md), [feature-result-contract.md](../../../spec/features/feature-result-contract.md), [feature-owner-gate-sla.md](../../../spec/features/feature-owner-gate-sla.md).
- Delivered seams the suites ride: `packages/cli/src/production.ts` (single state-directory resolution today), `packages/mcp/src/serve.ts` (`stateIdentity`), `packages/core/src/config/catalog.ts` (`resolveStateDirectoryScope`, `resolveDaemonSettings`), `packages/adapters/src/repo/index.ts` (`resolveCheckoutGitDirectories`, `findGitRoot`), `packages/adapters/src/file/dispatch-identity.ts` (create-once marker discipline), `packages/core/src/domain/dispatch-authority.ts` + `packages/core/src/app/dispatch-ledger.ts` (folded truth and derived view), `packages/adapters/src/file/owner-hold-marker.ts`, `scripts/lib/dispatch-authority.sh` (bash fallback), `packages/cli/src/help/prompt-required-commands.ts`.
- Comparable delivered test plans: [chg-GH-273-test-plan.md](../2026-11-08--GH-273--queue-repository-binding/chg-GH-273-test-plan.md) (evidence classes, revert sets, fixture discipline) and [chg-GH-241-test-plan.md](../2026-11-07--GH-241--coordinator-supervision/chg-GH-241-test-plan.md).
- Ticket: GH-288 (M2-S11). Scenario seeds: SC-M2-S11-01 → TC-PROJ-001/002; SC-M2-S11-02 → TC-PROJ-007 (+ TC-PROJ-006 and TC-PROJ-011 for the absent-index first run and the exact entry shape, per spec Appendix E).

## 3. Coverage Overview

Every acceptance criterion names an evidence class in spec §17. This plan mirrors those classes exactly; it never upgrades a `review-verified` criterion to `suite`, and never claims a revert for an assertion that passes identically before the change. Evidence classes used below: **Suite** (a committed assertion that runs in `pnpm check`), **Suite + revert** (a suite assertion that must turn red when the named pre-change behaviour is restored in place), **Suite + mutation** (a suite assertion whose detection power is proven by a named in-place mutation, because the pre-change code already exhibits the guarded behaviour), **Review-verified** (a diff/content inspection recorded in the change review and §10).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | Two checkouts of different repositories, one host root, same ref: phase documents and queue records are disjoint file and key sets; neither store holds a record the other wrote. | TC-PROJ-001 | Suite + revert (P1) | Covered |
| AC-F1-2 | `phase list`, `queue list`, `lanes`, `status`, `dispatch` each report only their own checkout's state. | TC-PROJ-002 | Suite | Covered |
| AC-F1-3 | Key and state location identical from a nested directory, a linked worktree, after rename, and after a move; only the reported root changes; a nested repository resolves to its own project. | TC-PROJ-003 | Suite | Covered (worktree `root` expectation: resolution R-1) |
| AC-F1-4 | Two clones of one remote are two projects; all worktrees of one clone are one project; the marker is created once, atomically, `0600`, never rewritten, and carries no hardcoded name. | TC-PROJ-004 | Suite | Covered |
| AC-F1-5 | An invocation whose `cwd` is not inside a git work tree resolves to the declared host-scoped `unbound` root (no failure, no invented key), emits exactly one bounded warning naming the unbound condition, registers no project in the host index, creates no project state root, keeps its exit code unchanged, and never substitutes a path-derived key. | TC-PROJ-005 | Suite | Covered — this TC is the criterion's owning test (spec Appendix D) |
| AC-F2-1 | No index → exit `0`, empty `data.projects`, `hostIndexRevision` `0`, **no** `projects.registry-corrupt`; an invocation inside a checkout creates the index and the next list reports the project. | TC-PROJ-006 | Suite + mutation (P2) | Covered |
| AC-F2-2 | Two managed checkouts with no hand-written registry report both projects with all five fields plus the revision, from either checkout. | TC-PROJ-007 | Suite | Covered |
| AC-F2-3 | Corrupt index refuses at exit `2` with `projects.registry-corrupt`, names the index, changes no file; the next state-opening invocation preserves the corrupt file as a timestamped sibling, writes a fresh index, and the following list succeeds. | TC-PROJ-008 | Suite | Covered |
| AC-F2-4 | A vanished root entry and an entry whose marker resolves to a different identifier are pruned; the referenced state roots are untouched; re-registration restores the same key and state location. | TC-PROJ-009 | Suite + mutation (P3) | Covered |
| AC-F2-5 | Revision increases monotonically per index write and is the revision the list reports; a recorded state location that disagrees is a warning and the derived location is reported. | TC-PROJ-010 | Suite + mutation (P4) | Covered |
| AC-F3-1 | Exactly the five contract fields per entry, ordered by `projectKey`, `data.hostIndexRevision` alongside `data.projects`, no new top-level envelope key. | TC-PROJ-011 | Suite | Covered |
| AC-F3-2 | Two runs produce byte-identical human output with exactly the columns `key`, `root`, `state`, `daemon`, `handover`, sorted by key; an unreachable daemon renders its reason. | TC-PROJ-012 | Suite | Covered (also carries the read-only/stability half of F-3; see §8.3 OQ-T2) |
| AC-F3-3 | Produced list `0`; unknown verb `1`; unreadable identity `1` with `projects.identity-unreadable`, naming the offending checkout root in the runtime summary plus the project key and identifier when the marker is readable but identity still does not resolve; present-but-unreadable state location `2` with `projects.state-unavailable`, naming the project key and its state location; no other project's root disclosed in the envelope, its warnings, or its text; no other exit code. | TC-PROJ-013 | Suite | Covered (naming rule per DEC-16) |
| AC-F4-1 | Folded `authoritative` + agreeing derived view → `engine`; folded `dual-run` → `shell`; no record and no view → `shell`. | TC-PROJ-014 | Suite | Covered |
| AC-F4-2 | Folded `authoritative` with an absent, `dual-run`, or malformed view → `in-transition`; folded `dual-run` with an `authoritative` view → `in-transition`. | TC-PROJ-015 | Suite + mutation (P5) | Covered |
| AC-F4-3 | `engine` only on agreement, `in-transition` only on disagreement, and a present-but-unreadable state location is a state failure rather than a fabricated state. | TC-PROJ-016 | Mutation (P5) + Suite (refusal half) | Covered |
| AC-F5-1 | The shipped composition reports `reachable: false` with the unmounted reason for every entry at exit `0`, and attempts no probe. | TC-PROJ-017 | Suite | Covered |
| AC-F5-2 | A mounted composition reports `reachable: true` with no reason against a bound socket, and `false` with the absent-socket reason when nothing is bound. | TC-PROJ-018 | Suite | Covered |
| AC-F5-3 | The reason is exactly the declared vocabulary member for absent socket, refused connect, and absent state root; the probe is bounded by the declared timeout and performs no write and no command. | TC-PROJ-019 | Suite | Covered |
| AC-F6-1 | Exactly one state-scope rule implementation below the CLI tier; the production composition, the MCP serve composition, **and the runtime-aware edge** all consume it; no surface composes a state directory from home and brand directly; and each of those sites honours the delivered environment override when it is set. | TC-PROJ-020 (structural) + TC-PROJ-021, TC-PROJ-022 (override honoured at runtime) | Suite | Covered (three derivation sites pinned; override honouring carried behaviourally by 021/022) |
| AC-F6-2 | `phase complete`, `queue add`, `commit`, `dispatch` write every store artifact under the project root with none at the host root; `status`, `lanes`, `retro`, `spend` read the same root. | TC-PROJ-021 | Suite + revert (P1) | Covered |
| AC-F6-3 | CLI and MCP open the identical project root for one checkout; MCP payload and error parity unchanged. | TC-PROJ-022 | Suite | Covered |
| AC-F6-4 | The daemon socket path derives from the project root and satisfies the inside-the-state-directory rule; an explicit outside path is refused. | TC-PROJ-023 | Suite | Covered |
| AC-F6-5 | The bash fallback reports `authoritative` from the project root, reports `dual-run` with no project root, keeps environment-override precedence, and does not widen its search depth. | TC-PROJ-024 | Suite + mutation (P6) | Covered |
| AC-F7-1 | A host-root owner-hold marker is observed by every project; the environment override outranks it; no per-project marker is read. | TC-PROJ-025 | Suite | Covered |
| AC-F8-1 | The move preserves every byte and mode, the audit chain still verifies, the retro sidecar still reads, the same reads work after the move, and the inverse move restores the pre-migration reads. | TC-PROJ-026 | Suite | Covered |
| AC-F8-2 | One warning naming the migration note on the error stream, nothing moved, nothing deleted, exit unchanged; no warning on a migrated host. | TC-PROJ-027 | Suite + mutation (P7) | Covered |
| AC-F8-3 | The marker stays at the host root, the hold still stops every project, and the note states the primary-checkout designation, the fresh-start consequence, owner-hold continuity, the `unbound` scope, and the reversal step. | TC-PROJ-028 | Review-verified (+ suite for the note's distribution class and registration) | Covered |
| AC-F9-1 | `--help` lists `projects`; `projects --help`, `projects list --help`, `--version` succeed at exit `0` with no state, network, git, or configuration read. | TC-PROJ-029 | Suite | Covered |
| AC-F9-2 | `pnpm check:help` and the parity test green; `projects` in the coverage inventory; its page registered; the page contains `--help` and `--version`. | TC-PROJ-030 | Suite (tree half) + Review-verified (M1-pages-unmodified half) | Covered (§8.3 OQ-T3) |
| AC-F9-3 | Exactly three rows under one new domain kind, each documented in the result-contract spec, no existing row added, retired, or reworded. | TC-PROJ-031 | Suite (rows) + Review-verified (unchanged-row half) | Covered |
| AC-F9-4 | No new hardcoded product or binary literal; every name resolves from the injected brand identity. | TC-PROJ-032 | Suite | Covered |
| AC-F10-1 | The state-layer, CLI-entrypoint, branding-seam, dispatch-engine, and owner-gate pages state the new root and the new surface, and a `projects` feature page exists. | TC-PROJ-033 | Review-verified | Covered |
| AC-F10-2 | The backlog entry, status snapshot, command registry, M2 entrypoint delta, and the command page's proposed status are reconciled. | TC-PROJ-034 | Review-verified | Covered |
| AC-F10-3 | Exactly one new changeset, five fixed-group packages at `minor`, the only one added, pre-existing ones byte-identical, no dependency or lockfile change. | TC-PROJ-035 | Suite (existing release suite) | Covered — no new test |

All 35 acceptance criteria (`AC-F1-1`…`AC-F10-3`, including `AC-F1-5`) are mapped; none is unmapped, marked TODO, or AC-less. Every test case names the AC it proves.

Functional capabilities are covered transitively: F-1 → 001, 002, 003, 004, 005; F-2 → 006, 007, 008, 009, 010; F-3 → 011, 012, 013; F-4 → 014, 015, 016; F-5 → 017, 018, 019; F-6 → 020, 021, 022, 023, 024; F-7 → 025, 026; F-8 → 026, 027, 028; F-9 → 029, 030, 031, 032; F-10 → 033, 034, 035.

### 3.2 Interface Coverage (DM-#, command surface, registries)

The spec declares no `API-` or `EVT-` identifiers (§8.1, §8.2 — the surface is the CLI, the state layout, and the host index; no event, message, or topic changes).

| Interface element | Observable contract | TC ID(s) |
|-------------------|---------------------|----------|
| DM-1 checkout identity marker | One file inside the git common directory; `0600`; created once via a synced sibling plus a link; never rewritten; shared by the clone's worktrees; travels with a renamed/moved checkout; carries a readable key plus an opaque identifier; no hardcoded name. | TC-PROJ-003, TC-PROJ-004 |
| DM-2 host index | One host-root document with a schema identity, a monotonic revision, and one entry per project (key, identifier, absolute root, derived state location, last write); derived, rebuildable, never authoritative. | TC-PROJ-008, TC-PROJ-010 |
| DM-3 project state root | `<host root>/projects/<project key>` holding exactly the delivered store artifacts under workspace `default`; the host root keeps only the index, the optional owner-hold marker, the project container, and `unbound`. | TC-PROJ-021, TC-PROJ-023, TC-PROJ-026 |
| DM-4 `projects.v1` envelope data | Entries with exactly five fields plus `data.hostIndexRevision`; entries sorted by key; `daemonReachable` is `{ reachable, reason? }`. | TC-PROJ-011, TC-PROJ-014, TC-PROJ-017 |
| DM-5 handover projection | Derived, unpersisted, closed value set `engine` \| `shell` \| `in-transition`, computed from the folded latest handover operation and the derived authority document. | TC-PROJ-014, TC-PROJ-015, TC-PROJ-016 |
| DM-6 error identities | `projects.identity-unreadable` (refusal, exit 1), `projects.registry-corrupt` (state, exit 2), `projects.state-unavailable` (state, exit 2), each with category, retryability, consequence, remediation, projection class, documented in the result-contract spec; the refusal's naming rule (offending checkout root, plus project key and identifier when the marker is readable but identity does not resolve, and no other project's root) is DEC-16. | TC-PROJ-013, TC-PROJ-031 |
| DM-7 owner-hold scope | Unchanged meaning and location: read at the host root, applies to every project, environment override keeps precedence, no per-project marker. | TC-PROJ-025, TC-PROJ-026 |
| `projects list` (text) | Deterministic table, columns `key`, `root`, `state`, `daemon`, `handover`, sorted by key, exit per contract. | TC-PROJ-012, TC-PROJ-013 |
| `projects list --json` | `{ ok, command, data, error?, warnings? }` with `data.projects[]` and `data.hostIndexRevision`; no new top-level key. | TC-PROJ-011, TC-PROJ-013 |
| `projects <other-verb>` | Refused at exit `1` under the shared invocation classification; no other verb exists. | TC-PROJ-013 |
| `projects --help`, `projects list --help`, `--version` | Served from the static help inventory; no state, network, git, or configuration read; documented on the reference page. | TC-PROJ-029, TC-PROJ-030 |
| Prompt-required composition | `projects` is a member of the exact set the entrypoint composes and drops everything outside; the board-family failure mode (composed but not prompt-required) must not repeat. | TC-PROJ-020, TC-PROJ-029, TC-PROJ-030 |
| Error table domain kinds | One new domain kind with exactly three rows; bidirectional doc sync green. | TC-PROJ-031 |
| Every store-opening command (grammar unchanged) | No grammar, flag, envelope, key order, or exit projection change; only the resolved state root changes. | TC-PROJ-021, TC-PROJ-036 |
| MCP surface | Same scope policy, therefore the same state root for the same checkout; tool names, payloads, and error parity unchanged. | TC-PROJ-022 |
| Shell fallback (bash) | Resolves the same project state root before locating the authority document; override precedence unchanged; search depth not widened. | TC-PROJ-024 |
| State-scope override (`<PREFIX>_STATE_DIR`) | The delivered override-aware rule is the host-root authority for **all three** derivation sites (production store, MCP store, runtime-aware edge audit store): an absolute override wins, otherwise home plus brand; no site composes home plus brand inline; a non-absolute override stays `config.value.invalid`. | TC-PROJ-020 (structural: no inline composition, one implementation), TC-PROJ-021 (store and audit ledger under the override), TC-PROJ-022 (MCP store under the override) |
| Runtime-aware edge audit store | The command audit store resolves under the same host root and, inside a checkout, under the project root — i.e. the edge consumes the policy rather than a private derivation. | TC-PROJ-021 |
| `unbound` host scope | A declared host-scoped root beside the project container; one bounded warning; no project registration; no project root; not reported as a project row. | TC-PROJ-005 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Notes |
|--------|-------------------------|----------|-------|
| NFR-1 | 0 shared store files and 0 cross-observed documents across the two-checkout same-ref scenario, asserted per read surface. | TC-PROJ-001, TC-PROJ-002, TC-PROJ-021 | File-set disjointness and per-surface observation are separate assertions, not one. |
| NFR-2 | 0 diffs in store artifact names, modes, and semantics; existing state suites green without modification. | TC-PROJ-036 | Suite-green half is automated; "without modification" and "0 diffs" are review-verified. |
| NFR-3 | Two identical human tables byte for byte; structurally identical JSON across runs and across index entry ordering. | TC-PROJ-012 | Includes the read-only/stability assertion (index bytes, revision, mtime unchanged). |
| NFR-4 | Maintenance p95 ≤ 10 ms with ≤ 1 index read and ≤ 1 write per invocation; `projects list` p95 ≤ 500 ms at 25 projects and ≤ 4 s at 200; per-project reads bounded to the handover prefix. | TC-PROJ-037, TC-PROJ-019 | Runtime counts via a counting index/edge seam; "no crawl" also asserted structurally. |
| NFR-5 | 0 `reachable: true` without a successful bounded connect; 0 `engine` without agreement; 0 `in-transition` without disagreement; 0 `projects.registry-corrupt` on an absent index. | TC-PROJ-006, TC-PROJ-008, TC-PROJ-013, TC-PROJ-016, TC-PROJ-017, TC-PROJ-019 | Each clause has its own assertion; none is inferred from another. |
| NFR-6 | 100% identical key and state location across rename, linked worktree, move, and nested invocation. | TC-PROJ-003, TC-PROJ-004 | Measured per cell, not as an average. |
| NFR-7 | 0 content changes across all store artifacts; audit chain verifies; retro sidecar reads; the inverse move restores the pre-migration reads. | TC-PROJ-026 | Byte and mode comparison per artifact plus functional reads. |
| NFR-8 | 0 writes outside the per-test temporary root, asserted by a guard that fails the suite on a leak. | TC-PROJ-038 | Pre-write guard (throws) plus post-run fingerprint of the real state directory (unchanged). |
| NFR-9 | 1 state-scope policy implementation; ≥ 7 consumers asserted structurally (CLI composition, MCP serve, runtime-aware edge audit store, daemon socket derivation, dispatch state root, retro sidecar, owner-hold read) plus the shell fallback; 0 inline home-plus-brand compositions remaining; the delivered override precedence honoured by all of them. | TC-PROJ-020, TC-PROJ-021, TC-PROJ-022 | Consumers enumerated explicitly in TC-PROJ-020; override honouring asserted behaviourally in TC-PROJ-021/022. |
| NFR-10 | 0 new product or binary literals; 0 new dependencies; 0 new workspace packages; boundary, literal, and licence gates green. | TC-PROJ-004, TC-PROJ-032, TC-PROJ-035, TC-PROJ-036 | |
| NFR-11 | `pnpm check` green with a temporary directory override, including help-coverage, reference-page parity, error-table sync, and the release gate. | All TCs (per-gate rows in §7) | Reported in §10 per gate, not as one aggregate verdict. |

## 4. Test Types and Layers

All new tests are `bun:test` suites under `tests/**`, discovered by `pnpm test`. Fixtures are never named `*.test.ts`.

- **Behaviour / integration (`tests/behaviour/projects-*.test.ts`)** — the real production composition (`createProductionComposer` → `runCli`) over real temporary host roots and real temporary git checkouts. Only external seams are injected (home directory, environment record, harness spawn runner, GitHub transport, git child runner, daemon capability, clock, run id). TC-PROJ-001…019, 021, 022, 025, 026, 027, 029.
- **Structural (`tests/structure/projects-*.test.ts`)** — TypeScript AST over `packages/**/src/**` plus declared allowlists; no composition, no fixture build, no `git` spawn. TC-PROJ-020 (all three derivation sites plus the seven-consumer allowlist), and the structural halves of TC-PROJ-024, TC-PROJ-036.
- **Structural extension (existing files)** — the bash-fallback assertions extend `tests/structure/dispatch-bash-authority.test.ts` (which already owns the "authority read is a plain file read" invariant and the forbidden-call scan) rather than creating a second owner of the same subject.
- **Checks (`tests/checks/projects-*.test.ts`)** — mutation-tested guards and meta-assertions: the isolation guard's negative controls (TC-PROJ-038), and the existing gate suites that this change must keep green (`error-table-sync`, `help-guide-coverage`, `reference-page-parity`, `forbidden-literals`, `privacy-literals`, `privacy-release`).
- **Unit / pure** — the state-scope policy over injected facts (host root, brand state directory name, resolved checkout identity), the handover projection function, the daemon reason selector, and the host-index entry predicate are asserted directly in their owning test files (fragments inside TC-PROJ-003/014/015/019) so a UI-level green cannot hide a pure-function regression.
- **Manual / review (evidence class: review-verified)** — TC-PROJ-028, TC-PROJ-033, TC-PROJ-034, the diff halves of TC-PROJ-030/031/035/036, and the whole revert/mutation bundle TC-PROJ-039.
- **Performance** — TC-PROJ-037 only. No new performance framework; the measurement runs inside the normal suite with recorded wall-clock in §10.

Runtime expectations: the two-checkout suites spawn `git` a bounded number of times (`git init` per fixture checkout, one `git worktree add` in TC-PROJ-003, `git clone` twice in TC-PROJ-004) and should stay under ~8 s per file on a warm cache; the structural files are file-read-only and stay under ~1 s; the migration suite copies small stores and stays under ~2 s; TC-PROJ-037 dominates the new runtime at ~10–20 s and is the one file allowed to exceed the others.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | Evidence Class | AC Coverage |
|-------|-------|------|-------|----------|----------------|-------------|
| TC-PROJ-001 | Two checkouts, one ref: disjoint phase and queue state | Happy Path | Integration | High | Suite + revert (P1) | AC-F1-1, NFR-1 |
| TC-PROJ-002 | No read surface observes the other checkout | Regression | Integration | High | Suite | AC-F1-2, NFR-1 |
| TC-PROJ-003 | Identity matrix: nested, worktree, rename, move, nested repo | Edge Case | Integration | High | Suite | AC-F1-3, NFR-6 |
| TC-PROJ-004 | Two clones are two projects; worktrees are one; marker discipline | Corner Case | Integration | High | Suite | AC-F1-4, DM-1, NFR-6, NFR-10 |
| TC-PROJ-005 | Declared `unbound` scope outside any work tree | Edge Case | Integration | High | Suite | AC-F1-5, DM-3 |
| TC-PROJ-006 | Absent index is an ordinary first run and is created by use | Happy Path | Integration | High | Suite + mutation (P2) | AC-F2-1, NFR-5 |
| TC-PROJ-007 | Discovery without a registry: two rows, five fields, from either checkout | Happy Path | Integration | High | Suite | AC-F2-2, DM-4 |
| TC-PROJ-008 | Corrupt index: honest refusal, then evidence-preserving recovery | Negative | Integration | High | Suite | AC-F2-3, DM-2, DM-6, NFR-5 |
| TC-PROJ-009 | Pruning is index-only and re-registration recovers the same root | Regression | Integration | High | Suite + mutation (P3) | AC-F2-4, DM-2 |
| TC-PROJ-010 | Monotonic revision; state location always re-derived | Regression | Integration | High | Suite + mutation (P4) | AC-F2-5, DM-2 |
| TC-PROJ-011 | Envelope shape: exactly five fields, key order, no new top-level key | Contract | Integration | High | Suite | AC-F3-1, DM-4 |
| TC-PROJ-012 | Deterministic table, reason rendering, and a read-only list | Regression | Integration | High | Suite | AC-F3-2, NFR-3 |
| TC-PROJ-013 | Exit-code matrix, DEC-16 refusal naming, and the three error identities | Negative | Integration | High | Suite | AC-F3-3, DM-6, NFR-5 |
| TC-PROJ-014 | Handover projection: `engine` and `shell` rows | Happy Path | Integration | High | Suite | AC-F4-1, DM-5 |
| TC-PROJ-015 | Handover projection: every disagreement cell is `in-transition` | Corner Case | Integration | High | Suite + mutation (P5) | AC-F4-2, DM-5 |
| TC-PROJ-016 | No invented handover state; unreadable state location is an error | Negative | Integration | High | Mutation (P5) + Suite | AC-F4-3, NFR-5 |
| TC-PROJ-017 | Unmounted ship: declared reason, no probe, exit 0 | Happy Path | Integration | High | Suite | AC-F5-1, DM-4 |
| TC-PROJ-018 | Mounted probe: bound socket reachable, absent socket declared | Happy Path | Integration | High | Suite | AC-F5-2 |
| TC-PROJ-019 | Closed reason vocabulary, bounded probe, no write, no command | Negative | Integration + Unit | High | Suite | AC-F5-3, NFR-4, NFR-5 |
| TC-PROJ-020 | One state-scope policy across three derivation sites, every consumer, no inline composition | Regression | Structural | High | Suite | AC-F6-1, NFR-9 |
| TC-PROJ-021 | Write placement, override honouring, and read parity across the command families | Regression | Integration | High | Suite + revert (P1) | AC-F6-2, AC-F6-1 (override clause), DM-3, NFR-1 |
| TC-PROJ-022 | MCP and CLI open the identical project root under the override | Regression | Integration | High | Suite | AC-F6-3, AC-F6-1 (override clause), NFR-9 |
| TC-PROJ-023 | Daemon socket derives from the project root; outside path refused | Regression | Integration + Unit | High | Suite | AC-F6-4, DM-3 |
| TC-PROJ-024 | Bash fallback resolves the project root without widening its search | Regression | Structural + Integration | High | Suite + mutation (P6) | AC-F6-5 |
| TC-PROJ-025 | Owner hold stays host-wide across projects | Regression | Integration | High | Suite | AC-F7-1, DM-7 |
| TC-PROJ-026 | Migration preserves bytes, modes, audit chain, and retro sidecar; inverse move restores | Happy Path | Integration | High | Suite | AC-F8-1, DM-3, DM-7, NFR-7 |
| TC-PROJ-027 | Legacy detection warns once and moves nothing | Negative | Integration | High | Suite + mutation (P7) | AC-F8-2 |
| TC-PROJ-028 | Migration note content, distribution class, and registration | Documentation | Manual + Structural | High | Review-verified (+ suite) | AC-F8-3, F-10 |
| TC-PROJ-029 | `projects` is reachable from the built help surface with no side effects | Happy Path | Integration | High | Suite | AC-F9-1 |
| TC-PROJ-030 | Help-coverage, reference-page parity, and inventory registration | Contract | Structural | High | Suite + Review-verified | AC-F9-2 |
| TC-PROJ-031 | Exactly three error rows under one new domain kind, documented both ways | Contract | Structural | High | Suite + Review-verified | AC-F9-3, DM-6 |
| TC-PROJ-032 | No new hardcoded product or binary literal | Regression | Structural | High | Suite | AC-F9-4, NFR-10 |
| TC-PROJ-033 | System-spec reconciliation | Documentation | Manual | High | Review-verified | AC-F10-1 |
| TC-PROJ-034 | Planning-corpus reconciliation | Documentation | Manual | High | Review-verified | AC-F10-2 |
| TC-PROJ-035 | Release changeset shape | Contract | Structural | High | Suite (existing) | AC-F10-3, NFR-10 |
| TC-PROJ-036 | State contract preserved and existing suites green unmodified | Regression | Structural + Review | High | Suite + Review-verified | NFR-2, NFR-10 |
| TC-PROJ-037 | Bounded work: latency, maintenance cost, read/write counts, no crawl | Performance | Integration | Medium | Suite | NFR-4 |
| TC-PROJ-038 | Test isolation: guard, leak detector, no real-state writes | Regression | Checks | High | Suite | NFR-8 |
| TC-PROJ-039 | Revert and mutation evidence bundle (P1–P7) | Regression | Manual | High | Review-verified | NFR-4 evidence discipline; AC-F1-1/2-1/2-4/2-5/4-2/4-3/6-2/6-5/8-2 evidence classes |

### 5.2 Scenario Details

#### TC-PROJ-001 - Two checkouts, one ref: disjoint phase and queue state

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1, G-1, DM-1, DM-3, SC-M2-S11-01
**Evidence Class**: Suite + revert (P1: restoring the single host root reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-scope-isolation.test.ts` over `tests/fixtures/projects/temp-repos.ts` and `tests/fixtures/projects/production.ts`
**Tags**: @backend, @state, @cli, @isolation

**Preconditions**:

- An approved temporary base directory (`PROJECTS_TEMP_BASE`, §6), a per-test temporary **host root** `H`, and a per-test temporary home; `<PREFIX>_STATE_DIR` is set to `H` as an absolute path and `HOME` points at the temporary home.
- Two **real** git repositories created with `git init -b main` under the approved base, each with one commit and with `GIT_CEILING_DIRECTORIES` pinned to the base so no fixture can discover the repository that runs the test. They are different repositories with different common directories (`<repo>/.git`), and **both are working the same ref `GH-241`** (same branch name and same change folder name; their remote URLs differ only in the repository name).
- The production composition is built per checkout with the real `cwd`; no root or key is injected.

**Steps**:

1. In checkout A, run the delivered `queue add GH-241 --priority 1 --json`.
2. In checkout B, run the delivered `queue add GH-241 --priority 5 --json`.
3. In A, complete two phases of `GH-241` with the delivered `phase complete` grammar; in B, complete one phase of `GH-241`.
4. Resolve each checkout's project root through the delivered state-scope policy (the same call the composition makes) and capture both roots.
5. Read each store's artifacts: `documents.<default>/phase-state.GH-241.json`, the ledger records under `queue.entries:GH-241`, and the full file list of each project root.

**Expected Outcome**:

- Two distinct project roots exist, `<H>/projects/<key-A>` and `<H>/projects/<key-B>`; `key-A !== key-B`; each key is a single path segment (no `/`, not `.` or `..`).
- `phase-state.GH-241.json` exists under **both** roots (same file name, by design) and the two files' bytes differ: A's document records two completed phases, B's records one.
- A's store contains exactly one queue record for `GH-241` with `priority === 1`; B's contains exactly one with `priority === 5`. **Neither ledger contains a record the other wrote**: A's record set carries no `priority === 5` record and B's carries no `priority === 1` record (asserted per record, not per count).
- The store file names under each root are exactly the delivered layout under workspace `default` (`ledger.default.jsonl`, `header.default.json`, `documents.default/`, and the rest of the delivered artifact set); no artifact from one project appears under the other's root.
- The host root `H` contains no store artifact: its listing is exactly the host index plus the `projects/` container (plus the owner-hold marker when TC-PROJ-025's fixture sets one).

**Notes / Clarifications**:

- The file name `phase-state.GH-241.json` and the key `queue.entries:GH-241` are **identical in both projects** — that identity is the defect being corrected, so the assertions are cross-store record checks, not path-name checks. Asserting "the paths differ" alone would pass on any two directories and prove nothing.
- The two checkouts are real repositories because the identity input is `resolveCheckoutGitDirectories`; a fabricated `.git` directory is accepted only in the cells that do not assert git semantics (TC-PROJ-007/008/009/010 build their fixtures from real `git init` too, for uniformity, and it costs one process spawn per fixture).
- Pre-change behaviour (P1) reds this test at its first assertion: both checkouts open `<H>`, so both write the same `phase-state.GH-241.json` and A's ledger read returns a record carrying B's priority.

#### TC-PROJ-002 - No read surface observes the other checkout

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-1, G-1, SC-M2-S11-01
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-scope-isolation.test.ts` (same fixture as TC-PROJ-001)
**Tags**: @backend, @cli, @state, @dispatch

**Preconditions**:

- TC-PROJ-001 state: A and B have different phase positions and different queue priorities for `GH-241`, in two distinct project roots.
- A recording harness spawn runner (returns a completed session), a recording git child runner, a refusing credential port, and a fixed clock are injected, so nothing reaches the network, a model, or a real worktree.

**Steps**:

1. In A and in B: `phase list --json`, `queue list --json`, `lanes list --json`, `status --json`.
2. In A and in B: `dispatch GH-241 --json` with the recording runner; capture exit, `data`, and the dispatch attempt records under each project root.
3. For every output and every envelope, scan for the other checkout's project key, root, and state location strings.
4. Compare each surface's reported values with the checkout that produced them.

**Expected Outcome**:

- A's `phase list` reports two completed phases; B's reports one. Neither reports the other's count.
- A's `queue list` reports `priority 1`; B's reports `priority 5`; each reports exactly one entry and neither raises `queue.entry.unobserved`.
- `lanes list` in each checkout reports only its own lease/queue state (the same ref produces one independent lane view per project).
- `status --json` in each checkout reports its own queue position and phase evidence; no field carries the other project's key or root.
- `dispatch GH-241` in each checkout passes the observation gate and appends exactly one attempt record **under its own project root**; the other project's attempt ledger is byte-unchanged across the invocation.
- The other checkout's project key, root, and state location strings occur **zero** times in every captured stdout/stderr of steps 1–2.

**Notes / Clarifications**:

- `dispatch` is included because it is the surface where a cross-observed queue entry would be acted on rather than merely displayed. The attempt-ledger byte comparison is the observable that distinguishes "read the wrong store" from "read the right store and found nothing".
- Assertion wording follows spec Appendix E: the seed's "neither `projects list` row references the other ref" is restated as "no read surface observes the other's phase completion, entry, or lease", because a project row carries no ref by contract.

#### TC-PROJ-003 - Identity matrix: nested, worktree, rename, move, nested repo

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-6, G-2, DM-1, RSK-3
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-identity.test.ts` over `tests/fixtures/projects/temp-repos.ts`
**Tags**: @backend, @state, @git, @identity

**Preconditions**:

- One real repository `R` under the approved base with a real commit, a real linked worktree created with `git worktree add` (`R-wt`), a nested directory inside `R` (`R/packages/core/src/deep`), and a second real repository `R-inner` created **inside** `R` at `R/vendor/inner` with its own `.git`.
- One temporary host root `H` and one temporary home, shared by every cell so key equality is meaningful.

**Steps**:

1. Resolve the scope from the checkout root `R`; capture `projectKey`, `stateLocation`, `root`.
2. Resolve from the nested directory `R/packages/core/src/deep`; capture the three values.
3. Resolve from the linked worktree `R-wt`; capture the three values.
4. Rename `R` to `R-renamed` in place and resolve from the renamed path; capture the three values.
5. Move `R-renamed` to a different parent directory on the same filesystem and resolve from the moved path; capture the three values.
6. Resolve from `R/vendor/inner` and from a nested directory inside it.

**Expected Outcome**:

- Cells 1–5 report the **same** `projectKey` and the **same** `stateLocation`; only `root` changes, and only for cells 4–5 (the renamed/moved path). Cell 2's `root` equals `R` (the nearest enclosing `.git` wins), not the nested directory.
- Cell 3 (linked worktree) reports the same `projectKey` and `stateLocation` as cells 1–5, and its `root` is the invoking worktree's absolute path (**resolution R-1**, §8.3).
- Cell 6 reports a **different** `projectKey` and a **different** `stateLocation` from `R`: a nested repository is its own project.
- No cell produces a second marker: after the whole matrix, the count of identity-marker files under each common directory is exactly one for `R` (travelling with it through rename and move) and exactly one for `R-inner`.

**Notes / Clarifications**:

- The worktree cell is the only one that can distinguish "key from the working directory" from "key from the common directory"; the rename and move cells are the only ones that can distinguish a persisted key from a path-derived one (RSK-3).
- `git worktree add` is a real spawn; it is the only way to produce a genuine `gitdir:` + `commondir` pair without hand-writing metadata that the production code would then be tested against.
- Assertion helper: the test compares `JSON.stringify([key, stateLocation])` across cells rather than comparing roots, so a root change cannot mask a key change.

#### TC-PROJ-004 - Two clones are two projects; worktrees are one; marker discipline

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, DM-1, NFR-6, NFR-10, G-2, RSK-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-identity.test.ts`
**Tags**: @backend, @state, @git, @identity, @security

**Preconditions**:

- A local bare repository used as `origin`, cloned twice into `clone-a` and `clone-b` (identical remote URL, distinct common directories), each with two linked worktrees created by `git worktree add`.
- One temporary host root `H`; the identity marker name comes from the delivered contracts constant, never a literal in the test.

**Steps**:

1. Resolve the scope from `clone-a`, `clone-a`'s first worktree, `clone-a`'s second worktree, `clone-b`, and `clone-b`'s worktree; capture keys and state locations.
2. Stat the marker in each common directory: path, existence, mode, and byte content.
3. Run four further resolution invocations from `clone-a`; then re-stat the marker.
4. On a fresh clone `clone-c` (no marker yet), start two resolution invocations concurrently in two processes and compare their reported keys.
5. Parse the marker content and scan the whole file for the forbidden-literal seed set and for any value equal to a hardcoded product or binary name.

**Expected Outcome**:

- `clone-a` and `clone-b` are **two projects** with distinct `projectKey` and distinct `stateLocation`, even though both remote URLs are identical.
- `clone-a` and both of its worktrees resolve to **one** project: identical `projectKey` and identical `stateLocation`.
- The marker lives inside the git **common** directory; mode is `0600` (`statSync(...).mode & 0o777 === 0o600`); content is non-empty JSON carrying a readable key and an opaque identifier.
- After the four further invocations, the marker's bytes, inode, and mtime are unchanged: created once, never rewritten.
- The concurrent first use lands exactly one marker: both processes report the same `projectKey`, and no `<marker>.*.tmp` sibling remains in the common directory.
- The marker bytes contain none of the seed literals (`ados`, `ADOS_`, `~/.ados`) and no hardcoded binary name; the key and identifier are values the tool minted, not names copied from the surrounding environment.

**Notes / Clarifications**:

- `0600` and create-once are asserted directly rather than only by reading the adapter, because this is the discipline the spec re-uses from the dispatch identity marker (DM-1, §21 "Marker integrity"); a plain `writeFileSync` would pass a "marker exists" test and fail this one.
- The concurrency cell is best-effort: the assertion is "one marker and two equal keys", which holds under either race outcome because the create-once link makes the loser read the winner's file. Do not assert *which* process created it.

#### TC-PROJ-005 - Declared `unbound` scope outside any work tree

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-5, DM-3, DEC-10, NFR-5, §7.1, Appendix A row 10, Appendix D
**Evidence Class**: Suite (this TC is `AC-F1-5`'s owning test, named in spec Appendix D)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-identity.test.ts`
**Tags**: @backend, @state, @scope

**Preconditions**:

- A directory outside **every** git work tree, produced by the delivered GH-273 pattern (`makeNonCheckoutDirectory`): first `mkdtempSync(tmpdir())`, and when `TMPDIR` points inside the repository (the aggregate gate's repo-local temp) fall back to a directory under the repository's parent. The fixture asserts `findGitRoot(dir, nodeRepositoryIo()) === undefined` before composing and fails loudly otherwise.
- A temporary host root `H` and temporary home; two registered projects already exist in `H`'s index, so "registers nothing" is observable against a non-empty index.
- A pre-run snapshot of `H`: the index bytes and revision, and the full listing of `H/projects/`.

**Steps**:

1. From the outside directory, run `status --json` with the production composition.
2. Capture stderr verbatim, the exit code, the resolved scope facts, and the full listing of `H` after the run.
3. Run `projects list --json` from the same directory.
4. Run the same command from inside one of the registered checkouts and compare exit codes.

**Expected Outcome**:

- Exit `0`, and the exit code equals the exit code the same command produces inside a registered checkout (step 4): only the scope is declared, the capability stays available, so the unbound condition never changes an exit code.
- The store is opened under the declared host-scoped `unbound` root (`H/unbound`), which is **not** inside `H/projects/` and is not attributed to any project; the resolved scope carries no project key at all.
- Exactly one bounded warning is written to stderr, naming the unbound condition (that the state is not repository-scoped) — once, not one per artifact and not repeated per command family.
- The host index is byte- and revision-identical to the pre-run snapshot: no project is registered, and no new entry is created.
- `H/projects/` is unchanged: no project state root is created and no identity marker is minted anywhere on the filesystem.
- No path-derived project key is ever substituted for the missing checkout identity: the resolved scope exposes no key, and no value derived from the directory name (basename, hash of the path, or a `default`-style placeholder) appears in the store identity, the index, or any envelope field.
- `projects list --json` at exit `0` does **not** report the `unbound` scope as a project row, and the previously registered two projects are still reported.

**Notes / Clarifications**:

- `AC-F1-5` was added in spec v1.1 after this plan's v1 flagged the behaviour as gap G-1; this TC is now the criterion's owning test and the traceability is recorded in spec Appendix D. No behaviour in the test changed except that the assertions now map one-to-one onto the criterion's clauses: declared scope, one bounded warning, no registration, no project root, unchanged exit code, no path-derived key.
- The "no project root" and "index unchanged" assertions are the load-bearing ones: an implementation that reused the primary project root, or registered a synthetic project, would pass a "warning emitted" test and fail these.
- The warning is asserted for its naming and its bound (exactly one occurrence), not for exact prose, so a wording refinement during delivery does not invalidate the evidence.

#### TC-PROJ-006 - Absent index is an ordinary first run and is created by use

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1, NFR-5, RSK-5, DEC-5, DEC-14
**Evidence Class**: Suite + mutation (P2: mapping an absent index to corruption reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-host-index.test.ts`
**Tags**: @backend, @cli, @projects, @first-run

**Preconditions**:

- A fresh temporary host root `H` that contains nothing (asserted empty), a temporary home, and one real checkout `R` under the approved base that has never been used.

**Steps**:

1. Assert `H` is empty and no index document exists.
2. Run `projects list --json` from outside any checkout.
3. Re-list `H`.
4. Run `status --json` inside `R`.
5. Run `projects list --json` again, from outside any checkout and from inside `R`.

**Expected Outcome**:

- Step 2: exit `0`; `data.projects === []`; `data.hostIndexRevision === 0`; no `error` member; **no** `projects.registry-corrupt` anywhere in the envelope or on stderr.
- Step 3: `H` is still empty — the list is read-only and does not create an index.
- Step 4: exit `0`, and the index document now exists at the host root with revision `1`, containing exactly one entry for `R` (key, identifier, absolute root, derived state location, last-write time). `R`'s project root exists and is empty (no store artifact was needed by `status` beyond the index registration; if the delivered composition opens the store, the artifact set is the delivered layout and still under `R`'s project root).
- Step 5: both runs report exactly one project with `projectKey` equal to the key minted in step 4, and `data.hostIndexRevision === 1`. Same two runs produce identical `data` (the list does not bump the revision).
- No run at any step reports `projects.registry-corrupt`.

**Notes / Clarifications**:

- This is the assertion that distinguishes "absent" from "corrupt" (DEC-14): the mutation P2 rewrites the reader so an absent index returns the corrupt error, and this test must red on step 2 with exit `2` where it expects exit `0`.
- The step-3 emptiness check is what makes "read-only" observable on the first run; step 5's revision equality makes it observable afterwards.
- `status` is used as the state-opening invocation because it is the cheapest delivered command that reaches the composition; the maintenance path is not command-specific (F-2, Flow 1).

#### TC-PROJ-007 - Discovery without a registry: two rows, five fields, from either checkout

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-2, DM-4, G-3, G-4, SC-M2-S11-02
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-host-index.test.ts`
**Tags**: @backend, @cli, @projects

**Preconditions**:

- Two real checkouts `R-a` and `R-b` (distinct repositories, distinct common directories) that have each run one state-opening command, so both are registered by use.
- No hand-written registry anywhere: the test asserts that the only host-level documents under `H` were created by the tool run (captured by listing `H` before the first command and diffing after).
- Neither checkout has ever run `projects list` before this test.

**Steps**:

1. Run `projects list --json` from inside `R-a`; capture the envelope.
2. Run `projects list --json` from inside `R-b`; capture the envelope.
3. Run `projects list --json` from a directory outside every checkout; capture the envelope.
4. For each captured entry, assert the field set and the value provenance.

**Expected Outcome**:

- All three runs return **both** projects (`data.projects.length === 2`), each carrying `projectKey`, `root`, `stateLocation`, `daemonReachable`, and `handoverState`, plus `data.hostIndexRevision`.
- The two rows' `projectKey` values are distinct; their `root` values equal the absolute `R-a` and `R-b` paths; their `stateLocation` values equal `<H>/projects/<their key>`.
- The three envelopes' `data.projects` arrays are deep-equal and in the same order: the produced list does not depend on which checkout asked.
- `root` values are absolute and are the real checkout paths (not the current working directory and not the host root).
- No file in `H` is operator-authored: every host-level document is one the tool wrote during the fixture's own runs.

**Notes / Clarifications**:

- This is the ticket's second acceptance criterion and SC-M2-S11-02. "Managed checkout" is reconciled to "a checkout a command has been run in" (spec Appendix E): the test's precondition *is* the prior use, and it deliberately runs no overview before the first state-opening command, so "no prior overview run" is also exercised.
- Running from outside a checkout is the cell that proves the surface is a host overview rather than a checkout report.

#### TC-PROJ-008 - Corrupt index: honest refusal, then evidence-preserving recovery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2, DM-6, NFR-5, DEC-14, RSK-5
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-host-index.test.ts`
**Tags**: @backend, @cli, @projects, @state-recovery

**Preconditions**:

- A registered checkout `R` whose host index exists and is valid at revision `n`.
- The test then replaces the index document content with a non-parsable payload (`{ "schema": ` truncated) and records the exact bytes written.

**Steps**:

1. Run `projects list --json` with the corrupt index; capture exit, `error`, and stderr.
2. Re-read the index bytes and the full listing of `H` and assert nothing changed.
3. Run `status --json` inside `R` (a state-opening invocation).
4. Re-list `H`.
5. Run `projects list --json` again.

**Expected Outcome**:

- Step 1: exit `2`; `error.code === "projects.registry-corrupt"`; the error names the index (its file name or path) and does not echo record content; no `data` member.
- Step 2: the index bytes are byte-identical to the corrupted content (the failed read changed no file); `H`'s listing is unchanged; no sibling file was created by the read.
- Step 4: the corrupt file is preserved as a **timestamped sibling** of the index whose bytes equal the corrupt content exactly; a fresh index exists containing exactly `R` with a revision restarting from `1`; no store file was deleted anywhere under `H`.
- Step 5: exit `0`, one project, revision `1`; no `projects.registry-corrupt`.
- The number of timestamped siblings is exactly one (a second corrupt read does not create a second sibling for the same failure), and each preserved sibling's bytes remain equal to the corrupt content.

**Notes / Clarifications**:

- "Changes no file" (step 2) and "preserves the corrupt file" (step 4) are different claims about different code paths; the first is the read path (DEC-5: the list never writes) and the second is maintenance.
- The negative control for "absent is not corrupt" lives in TC-PROJ-006; this test repeats it once at the end (fresh host root, no index) so a regression in either direction reds the same file.

#### TC-PROJ-009 - Pruning is index-only and re-registration recovers the same root

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-4, DM-2, DEC-4, RSK-6
**Evidence Class**: Suite + mutation (P3: deleting the referenced state root during pruning reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-host-index.test.ts`
**Tags**: @backend, @projects, @state-safety

**Preconditions**:

- Three registered projects: `P-gone` (its checkout root is moved away so the recorded root no longer exists), `P-rekeyed` (its checkout keeps its root but its identity marker is replaced with a different identifier), and `P-stable` (untouched), each with a **populated** state root (a queue entry and a phase document).
- A byte snapshot of every file under `H/projects/` (name → sha256) plus the directory mode of each project root.

**Steps**:

1. Run a state-opening invocation inside `P-stable` to trigger maintenance.
2. Read the host index and list its entries.
3. Re-take the byte snapshot of `H/projects/` and compare with the pre-maintenance snapshot.
4. Move `P-gone`'s checkout back to its recorded path and run a state-opening command there.
5. Resolve `P-rekeyed`'s key from its (new) marker and compare with its previous key.

**Expected Outcome**:

- After step 1: `P-gone` and `P-rekeyed` are **absent** from the index; `P-stable` is present; the revision increased by exactly one.
- Step 3: every file under `H/projects/` is byte-identical and its mode unchanged; **no** project root or artifact was deleted (`P-gone`'s root still exists on disk with its populated state, and `P-rekeyed`'s old root is intact). The only difference in `H/projects/` is any directory the maintenance legitimately created.
- Step 4: the re-registered checkout reports **the same** `projectKey` and **the same** `stateLocation` it had before, because its marker never changed; its previously written queue entry is readable again.
- Step 5: `P-rekeyed`'s key changed with its marker, confirming the marker — not the path — governs identity.

**Notes / Clarifications**:

- The mutation P3 makes pruning delete the referenced state root; this test must then red at step 3 with a missing artifact. That is the guard against RSK-6 (pruning as data loss).
- An "entry whose root now resolves to a different project identifier" is provoked by replacing the marker; the spec's wording is honoured by asserting the *index entry* is removed while the state root survives.

#### TC-PROJ-010 - Monotonic revision; state location always re-derived

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-5, DM-2, DEC-4, RSK-5, §21 tamper resistance
**Evidence Class**: Suite + mutation (P4: trusting the recorded location reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-host-index.test.ts`
**Tags**: @backend, @projects, @security

**Preconditions**:

- A registered checkout `R` whose index entry records a valid `stateLocation`, and a fresh host root used for the monotonicity half.
- The test can read and rewrite the index document (it is untrusted input by contract).

**Steps**:

1. Trigger three successive maintenance runs (three state-opening invocations in `R`) and read the index revision after each.
2. Run `projects list --json` and compare `data.hostIndexRevision` with the revision read from the index.
3. Rewrite `R`'s recorded `stateLocation` to an absolute path outside `H` (`/tmp/gh288-not-a-project`), leaving the key unchanged.
4. Run `projects list --json`; capture the reported `stateLocation`, any warning, and whether the injected path exists.
5. Run one state-opening invocation in `R`, then re-read the index entry.

**Expected Outcome**:

- Step 1: revisions are strictly increasing (`r1 < r2 < r3`), each increment by one per write, and no run writes twice (asserted by the counting index seam in TC-PROJ-037 as well).
- Step 2: `data.hostIndexRevision` equals the revision the index carries; it is the revision that was read, not a fresh computation.
- Step 4: the reported `stateLocation` is the **derived** `<H>/projects/<key>`, never the injected value; a warning names the project and states that the recorded location disagreed; the injected path (`/tmp/gh288-not-a-project`) still does not exist (nothing opened a store there).
- Step 5: the recorded value has been repaired to the derived value.
- Tampering with any other entry field does not change a reported `stateLocation` (the value is derived for every row).

**Notes / Clarifications**:

- Requirement §21 calls the index untrusted; the mutation P4 replaces the derivation with the recorded value, and step 4 must then red — both because the path is wrong and because `/tmp/gh288-not-a-project` must never be created.
- The warning is asserted for its presence and its naming, not for exact prose (the surface is a warning, not a contract field).

#### TC-PROJ-011 - Envelope shape: exactly five fields, key order, no new top-level key

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-4, G-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-list-contract.test.ts`
**Tags**: @backend, @cli, @contract

**Preconditions**:

- Two registered projects (TC-PROJ-007 fixture), one with daemon reason declared (unmounted build) so the optional `reason` member is exercised.

**Steps**:

1. Run `projects list --json`; capture the envelope.
2. Assert the top-level key set, the `data` key set, and each entry's key set.
3. Assert ordering.
4. Rewrite the index entries in reverse order and re-run.

**Expected Outcome**:

- Top-level keys are a subset of exactly `{ ok, command, data }` (plus `warnings` when a warning is present, plus `error` only on a failure): **no new top-level key**.
- `data` keys are exactly `{ projects, hostIndexRevision }`.
- Each entry's `Object.keys(entry).sort()` equals exactly `["daemonReachable","handoverState","projectKey","root","stateLocation"]` — no more, no fewer.
- `daemonReachable` is an object whose keys are a subset of `{ reachable, reason }`; `reason` is **absent** when `reachable === true` and is a member of the closed vocabulary when `false`.
- `handoverState` is one of `engine`, `shell`, `in-transition`.
- `projects.map(p => p.projectKey)` equals its own sorted copy (ascending), in both step 1 and step 4 — entry order in the index does not affect output order.
- `typeof data.hostIndexRevision === "number"` and it is an integer ≥ 0.

**Notes / Clarifications**:

- Exact-set assertions (`toEqual([...])` on sorted keys) are used because "exactly the five contract fields" is the contract; a `toContain` assertion would let a sixth field through.
- Step 4 is the ordering half; it is not part of NFR-3 (which is about determinism) but of AC-F3-1, so it lives here rather than in TC-PROJ-012.

#### TC-PROJ-012 - Deterministic table, reason rendering, and a read-only list

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-3, DEC-5, RSK-5
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-list-contract.test.ts`
**Tags**: @backend, @cli, @determinism

**Preconditions**:

- Two registered projects with unchanged state after registration; the shipped (unmounted) composition so the `daemon` column carries a reason token.
- A snapshot of the host root taken before the first run: every file's bytes and mtime, plus the index revision.

**Steps**:

1. Run `projects list` (text) twice, in immediate succession, with nothing else in between.
2. Compare the two stdout captures byte for byte; parse the header line and each row.
3. Re-take the host-root snapshot and compare.
4. Run `projects list --json` twice and compare the parsed structures.

**Expected Outcome**:

- The two text outputs are **byte-identical** (`expect(first).toBe(second)` on the exact stdout string, not a trimmed or normalized form).
- The header cells are exactly `["key","root","state","daemon","handover"]` in that column order.
- Rows are sorted by key ascending; the number of rows equals `data.projects.length` from the JSON form.
- For a project whose `daemonReachable.reachable` is `false`, the `daemon` cell contains the declared reason token (e.g. the unmounted reason) and is not a bare `false`, `no`, `-`, or empty string.
- Step 3: the host-root file set, every file's bytes, the index revision, and the index mtime are unchanged by two listings — the command is read-only with respect to delivery state.
- Step 4: the two JSON envelopes are deep-equal, and equal to the structure produced in step 1's runs (no state changed).

**Notes / Clarifications**:

- Byte-identity on the raw stdout is deliberate: a table that pads columns from a clock, a locale, or a map iteration order fails here and nowhere else.
- The read-only half is carried here and in TC-PROJ-008 step 2. Spec F-3 states read-only behaviour but no AC asserts it in isolation; see OQ-T2 in §8.3.

#### TC-PROJ-013 - Exit-code matrix, DEC-16 refusal naming, and the three error identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-6, DEC-16, NFR-5, §21 disclosure boundary
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-list-contract.test.ts`
**Tags**: @backend, @cli, @errors

**Preconditions**:

- A registered host with a valid index containing **at least two** projects, so "names no other project's root" is testable and not vacuous.
- A checkout whose git metadata cannot be parsed (the `.git` file's `gitdir:` target is unparsable or points nowhere), for the identity-refusal cell, and a second checkout whose identity marker is **readable** but whose identity still does not resolve (the marker parses but carries no usable key/identifier), for the key-and-identifier cell.
- A third project whose derived state location exists but is a **regular file** (deterministic "present but unreadable" without relying on permission bits).

**Steps**:

1. `projects list --json` on a healthy host → assert `0`.
2. `projects --json` (no verb) and `projects frobnicate --json` → assert exit `1` and the refusal classification; assert no index read occurred (index mtime unchanged).
3. Run `projects list --json` inside the checkout whose git metadata cannot be parsed; capture the exit code, `error`, `warnings`, the runtime summary, and the raw text output.
4. Run the same command inside the checkout whose marker is readable but unresolvable; capture the same fields.
5. Replace the third project's derived state location directory with a regular file; run `projects list --json`; capture the same fields.
6. Scan every capture for the **root prefix and state location of the other projects**.
7. Enumerate every exit code observed across steps 1–5.

**Expected Outcome**:

- Step 1: exit `0`.
- Step 2: exit `1` for both; the error is the shared invocation classification (unknown verb / malformed invocation) and names the refused verb; the index was not read or written.
- Step 3: exit `1` with `error.code === "projects.identity-unreadable"`; the error's **runtime summary names the offending checkout root** (the absolute path of the checkout the command ran in), the failure is not silently skipped, and no row is fabricated for that subject.
- Step 4: exit `1` with the same code; because the marker is readable but the identity does not resolve, the summary names **both the project key and the project identifier** recorded in that marker (in addition to the offending root, per DEC-16).
- Step 5: exit `2` with `error.code === "projects.state-unavailable"`; the summary names **the project key and its state location**; the opaque file is left in place (the command does not repair, delete, or move it).
- Step 6: no other project's `root` prefix and no other project's `stateLocation` occurs anywhere in the envelope, the warnings, or the text output of steps 3–5. The refusal names only the subject it is about.
- Step 7: the observed set of exit codes is exactly `{0, 1, 2}`; no other code is produced by the family.
- No error message contains record content, credentials, or a ref (the disclosure boundary of §20/§21).

**Notes / Clarifications**:

- Spec v1.1 closed the v1 ambiguity PG-2 by specifying the naming rule as `DEC-16`. This test therefore asserts a contract instead of selecting one of two readings: the offending checkout root is always named, the key and identifier are named exactly when the marker is readable and the identity still does not resolve, the state failure names the project key and state location, and no other project's root is disclosed.
- The "no other project's root" negative needs a host with at least two projects; with one project it would pass vacuously. That is why the precondition requires two, and why step 6 scans the text output as well as the envelope — a host overview must not turn one failure into a disclosure of the whole host.
- The "present but unreadable" provocation uses a regular file rather than `chmod 000` so the assertion is identical under a root-in-container CI user; permission-based variants are recorded as an optional additional cell and skipped when `process.getuid?.() === 0`.
- "No other exit code" is asserted as a set equality over the family's observed codes, which is the strongest statement a suite can make without enumerating an infinite input space.

#### TC-PROJ-014 - Handover projection: `engine` and `shell` rows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-5, G-5, Appendix B rows 1–2
**Evidence Class**: Suite
**Test Type(s)**: Integration (+ a direct unit assertion on the projection function)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-handover.test.ts` over the delivered `appendDispatchHandover` / `writeDispatchAuthority` seams and `tests/fixtures/state/harness.ts`
**Tags**: @backend, @projects, @dispatch

**Preconditions**:

- One temporary host root and three registered projects, each with its own store opened at `<H>/projects/<key>`.
- For each cell, the store is seeded through the delivered APIs, never by hand-writing the ledger: `appendDispatchHandover(store, token, record)` for the folded truth and `writeDispatchAuthority(store, token, view)` for the derived document.
- Cells: (a) folded latest operation `authoritative` + view `authoritative`; (b) folded latest operation `dual-run` + view `dual-run`; (c) folded `dual-run` + **no** derived document; (d) **no handover record** + no derived document.

**Steps**:

1. Seed cell (a), (b), (c), (d).
2. Run `projects list --json`.
3. Assert each row's `handoverState`.
4. Call the projection function directly with the same folded/view inputs and assert the same outputs.

**Expected Outcome**:

- Cell (a) → `engine`; cell (b) → `shell`; cell (c) → `shell`; cell (d) → `shell`.
- Cell (d) (a project with a state root but no handover record and no view) is `shell`, the documented safe default — not `engine` and not `in-transition`.
- The direct unit call returns the same four values, so a CLI-layer default cannot mask a projection regression.

**Notes / Clarifications**:

- Cells (b) and (c) both produce `shell`; they are asserted separately because they exercise different branches (view present-and-dual-run versus view absent).
- Seeding through the delivered APIs, rather than formatting ledger lines in the test, is what makes the projection test about the *fold* and not about the fixture's JSON.

#### TC-PROJ-015 - Handover projection: every disagreement cell is `in-transition`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-5, DEC-7, RSK-8, Appendix B rows 3–4, spec §6 Flow 5
**Evidence Class**: Suite + mutation (P5: making `in-transition` unreachable reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-handover.test.ts`
**Tags**: @backend, @projects, @dispatch

**Preconditions**:

- Four additional projects seeded as: (e) folded `authoritative` + view **absent**; (f) folded `authoritative` + view `dual-run`; (g) folded `authoritative` + view **malformed** (a document whose bytes are valid JSON but whose `schema` does not match, and a second sub-case of non-parsable bytes); (h) folded `dual-run` + view `authoritative`.
- A reversal is also exercised as a *sequence*: one project records `authoritative` then `dual-run`, with the view left at `authoritative` after the first write — the folded latest is `dual-run` while the view still says `authoritative` (cell h produced by real history, not by an inconsistent fixture).

**Steps**:

1. Seed cells (e)–(h) and the reversal sequence.
2. Run `projects list --json`.
3. Assert each row's `handoverState`.
4. Assert the full observed value set across TC-PROJ-014 and this test.

**Expected Outcome**:

- Cells (e), (f), (g) (both malformed sub-cases), and (h) → `in-transition`.
- The reversal sequence's project reports `in-transition` (folded `dual-run`, view still `authoritative`) — the second direction required by Appendix B row 4 — and reports `shell` immediately after the view is rewritten to `dual-run`.
- The observed `handoverState` values across all eight cells (four here, four in TC-PROJ-014) are a subset of `{engine, shell, in-transition}`: **no fourth value** is ever produced.
- `engine` never appears for a cell with a disagreement, and `in-transition` never appears for an agreeing cell.

**Notes / Clarifications**:

- The five-row truth table in spec §6 Flow 5 expands to eight concrete cells because row 3 ("authoritative" vs absent/dual-run/malformed) has three shapes and row 5 has one; this test covers four and TC-PROJ-014 covers four.
- Mutation P5 collapses the disagreement branch to `shell` (making `in-transition` unreachable); every cell in this test must then red while TC-PROJ-014 stays green. If TC-PROJ-014 also reds, the mutation was not confined to the disagreement branch and the evidence is invalid.
- The malformed sub-cases deliberately include both "parses but is out of shape" and "does not parse": a projection that only guards `JSON.parse` would pass one and fail the other.

#### TC-PROJ-016 - No invented handover state; unreadable state location is an error

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, DEC-7, DEC-8, NFR-5, RSK-8
**Evidence Class**: Mutation (P5) for the invention half; Suite for the refusal half
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-handover.test.ts`
**Tags**: @backend, @projects, @errors

**Preconditions**:

- The TC-PROJ-014/015 matrix as the invention half; one additional project whose derived state location is a **regular file** (not a directory) as the refusal half.

**Steps**:

1. Run the matrix and assert the implication both ways: `engine` ⇒ folded truth and view agree; `in-transition` ⇒ they disagree.
2. Run `projects list --json` with the unreadable state location present.
3. Assert nothing was fabricated for it.

**Expected Outcome**:

- Step 1 holds for all eight cells: the implication is asserted as a biconditional over the fixture's own recorded inputs (the test keeps the seeded inputs in a table and compares against the reported projection).
- Step 2: exit `2` with `projects.state-unavailable` naming the project key; `data` is absent; **no** `handoverState` value is reported for that project in any output (text or JSON).
- No partial list is emitted with a placeholder value (`unknown`, `n/a`, `shell`) for the failing project: the command either answers honestly or fails, never both.
- Nothing is written to the failing path (its bytes and mtime are unchanged; it is still a regular file).

**Notes / Clarifications**:

- This criterion exists to prevent a "safe default" from becoming an excuse: `shell` is the right default for *absent* evidence, and a state failure for *unreadable* evidence. The two must not collapse into one another, which is why this test asserts the error rather than a value.
- The suite half is the refusal; the mutation half is P5 combined with the biconditional in step 1.

#### TC-PROJ-017 - Unmounted ship: declared reason, no probe, exit 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-4, NG-4, G-5, Appendix C row 1
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-daemon-reachability.test.ts`
**Tags**: @backend, @projects, @daemon

**Preconditions**:

- The **shipped** production composition, which supplies no daemon capability, over two registered projects (one with a state root, one without).
- A recording daemon-capability factory injected in a second sub-case that throws if constructed, so "no probe was attempted" is observable rather than assumed.

**Steps**:

1. Run `projects list --json` with the shipped composition.
2. Run it again with the throwing capability factory installed as the only change.
3. Assert the reason token for both projects.

**Expected Outcome**:

- Every entry reports `daemonReachable.reachable === false` with `daemonReachable.reason === "daemon-not-mounted"` — including the project that *has* a state root and would otherwise report `socket-absent`: an unmounted build declares the mount state, and does not fall through to socket probing.
- Exit `0`; no error member.
- Step 2: still exit `0` and the same reason; the throwing factory is never constructed (assert construction count `=== 0`), proving no probe path was entered.
- No socket file is created inside any project root by the listing.

**Notes / Clarifications**:

- The reason is asserted as the exact vocabulary token, not as prose, because the token is machine-readable per DEC-6 and Appendix C.
- NG-4 is explicit that this build does not close the daemon mount gap; the test's job is to keep the *report* honest, not to make the daemon run.

#### TC-PROJ-018 - Mounted probe: bound socket reachable, absent socket declared

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, G-5, Appendix C rows 4–5
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-daemon-reachability.test.ts`
**Tags**: @backend, @projects, @daemon, @socket

**Preconditions**:

- A composition that **does** supply a daemon capability (the injected mount fact), over one registered project with a state root.
- The derived socket path is computed with the delivered configuration rule (`resolveDaemonSettings({ stateDirectory: projectRoot })` without an explicit `socket-path`), so the test binds to the path the product would use rather than to a path it invented.
- A real local unix socket server created with `net.createServer().listen(socketPath)` inside the project root; the socket directory is the project root itself (`0700`).

**Steps**:

1. Bind the socket; run `projects list --json`; capture the entry and the server's connection/data counters.
2. Close the server and delete the socket file; run the listing again.
3. Re-bind, then remove the project's state root entirely (with the capability still mounted); run the listing again.

**Expected Outcome**:

- Step 1: `daemonReachable.reachable === true` and the entry has **no** `reason` member; the server recorded exactly one connection and **zero** data frames (no protocol write, no payload, no command).
- Step 2: `reachable === false` with `reason === "socket-absent"`; no connect attempt reached anything (the server is closed; assert the probe returned within the timeout rather than hanging).
- Step 3: `reachable === false` with `reason === "state-absent"`; the probe was **not** attempted (connection count unchanged from step 2's baseline).
- The probe never creates the socket, never writes a file under the project root, and never mutates the store: the project root's file set and bytes are unchanged across all three runs.

**Notes / Clarifications**:

- Binding a real socket is what makes `reachable: true` meaningful; a fake capability that returns `true` would prove only that the test can return `true`.
- The zero-data-frame assertion is the observable form of "no command, no payload" (F-5, §21 probe safety); a connect-only probe satisfies it while a protocol handshake would not.
- `state-absent` takes precedence over `socket-absent` (Appendix C rows 2–3): the absence of the root makes the socket question unanswerable, so no probe is attempted.

#### TC-PROJ-019 - Closed reason vocabulary, bounded probe, no write, no command

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-4, NFR-5, Appendix C
**Evidence Class**: Suite
**Test Type(s)**: Integration + Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-daemon-reachability.test.ts` (integration) and a direct unit assertion on the reason selector
**Tags**: @backend, @projects, @daemon, @bounds

**Preconditions**:

- A mounted composition; four projects arranged to produce each reason: unmounted (a second composition), `state-absent`, `socket-absent`, `socket-unreachable`.
- For `socket-unreachable`: a real socket file left behind by a server that has been closed, so `connect` receives `ECONNREFUSED` deterministically (the file exists and is not a listening socket).
- The declared response timeout is read from the resolved daemon settings, not hardcoded in the test.

**Steps**:

1. Produce each reason and assert the exact token.
2. Measure the wall clock of the `socket-unreachable` probe.
3. Assert the file set and bytes of every project root before and after.
4. Call the reason selector directly for each condition.

**Expected Outcome**:

- The four observed tokens are exactly `daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable` — no other string appears in any `reason` member, and a reachable probe carries no reason at all.
- The probe returns within the declared `responseTimeoutMs` (asserted with a generous ceiling: measured `≤ timeout * 2`, and the test itself fails after `timeout * 4` rather than hanging) — the timeout is *declared*, so "bounded" means "bounded by the configured value", not "fast".
- No file under any project root is created, modified, or deleted by any of the four probes (byte snapshot equality), and no connection carried a data frame.
- The unit-level selector returns the same four tokens for the same four inputs.

**Notes / Clarifications**:

- The reason vocabulary is closed by contract (Appendix C); the assertion is set membership in the declared list *plus* exact equality per condition, so a new invented reason string fails.
- `ECONNREFUSED` via a stale socket file is used instead of a proxy or a firewall simulation because it is deterministic, local, and needs no privileges.

#### TC-PROJ-020 - One state-scope policy across three derivation sites, every consumer, no inline composition

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-12, NFR-9, RSK-2
**Evidence Class**: Suite (structural; revert-detecting against today's three derivation sites, two of which ignore the override)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/projects-state-scope-policy.test.ts` (TypeScript AST, following `tests/structure/state-scope.test.ts`)
**Tags**: @backend, @structure, @state, @boundaries

**Preconditions**:

- The source tree at the change branch; `typescript` is already a dev dependency used by existing structure suites.
- A declared consumer allowlist in the test (the seven structural consumers plus the shell fallback path), modelled on `STATE_CONSUMERS` in `tests/structure/state-scope.test.ts`. The seven are: production CLI composition, MCP serve, **runtime-aware edge audit store**, daemon socket derivation, dispatch state root, retro sidecar location, owner-hold read.

**Steps**:

1. AST-scan every `packages/**/src/**/*.ts` file for a state-directory derivation from home plus brand: any path-composition expression whose operands include `stateDirectoryName` (or an equivalent brand-derived directory name) combined with a home or environment-derived directory.
2. Assert the scan finds exactly **one** such site, and that it is the policy module (below the CLI tier, in `core`).
3. Assert the three known sites each consume the policy and contain no inline composition: `packages/cli/src/production.ts` (the delivery store), `packages/mcp/src/serve.ts` (the MCP store), and the runtime-aware edge's audit-store composition.
4. Assert each of the **seven** consumers consumes the policy rather than re-deriving: CLI composition, MCP serve, runtime-aware edge audit store, daemon socket derivation, dispatch state root, retro sidecar location, owner-hold read; plus the shell fallback (`scripts/lib/dispatch-authority.sh`) resolves the project root.
5. Assert the environment-variable suffix composition (`_STATE_DIR`) and the override read appear in exactly one place (the policy), so override precedence cannot be re-implemented per site.
6. Assert the policy's override branch is covered by a behaviour-adjacent assertion: the policy is called with `{ override: <absolute>, home, brandName }` and with `{ override: undefined, home, brandName }`, returning the override in the first case and home-plus-brand in the second, and returning `config.value.invalid` for a non-absolute override. (The end-to-end proof that each site honours it is carried by TC-PROJ-021 and TC-PROJ-022.)
7. **Seeded negative control:** in a temporary copy of `packages/`, inject the pre-change inline expression into a new file; assert the scan reports it and names the file. Repeat with an injected second copy of the override read and assert it is reported as a duplicate.
8. Assert `PROMPT_REQUIRED_COMMANDS` contains `projects` and the entrypoint's restriction step keeps it.

**Expected Outcome**:

- Exactly one derivation site exists, and the failure message names any additional file and line.
- `production.ts`, `serve.ts`, and the edge's audit-store composition all reference the policy and none contains `${...}/${...stateDirectoryName}` (or an equivalent) any more. **Reversion-detecting:** today all three exist — `production.ts` composes inline and ignores the override, `serve.ts` repeats the inline composition, and the edge applies the override-aware helper — so an unmodified tree reds this test at step 2 and again at step 3.
- All **seven** consumers plus the shell fallback are named by the assertion; an eighth surface that bypasses the policy fails deliberately.
- Steps 5–6: the override suffix, the override read, and the override precedence exist in exactly one place, and the policy returns the override when it is set. A site that re-implements precedence (even correctly) fails at step 5.
- The seeded negative controls report exactly the injected file (the scan cannot silently pass) and report the duplicated override read.
- `projects` is in the prompt-required set (the board-family failure mode, F-9/RSK-11).

**Notes / Clarifications**:

- Spec v1.1 corrected the premise: there are **three** derivation sites, and only the runtime-aware edge honours `<PREFIX>_STATE_DIR` today (the delivery store and the MCP store compose home-plus-brand inline, so an operator who sets the override sees the audit ledger relocate while the store stays under the home default). This test now pins all three, and `AC-F6-1` requires each to honour the override — which is why step 5 forbids a second precedence implementation instead of merely forbidding a second path composition.
- AST, not text: comments, strings, and documentation examples must not trip the rule, and a legitimate rename must not require editing line numbers.
- The allowlist is deliberate friction: adding a surface that derives a state path requires editing this test, which is the anti-recurrence intent (spec §22 "Test maintenance").
- Step 6 is a pure-function assertion, so it stays in the structural file without composing a program; the runtime half of the override clause belongs to TC-PROJ-021 (store and audit ledger) and TC-PROJ-022 (MCP store), where a real host root and a real environment record exist.
- Step 8's prompt-set assertion lives here rather than in TC-PROJ-030 because it is a structural property of the composition, and TC-PROJ-030 asserts the *documentation* gates over the same set.

#### TC-PROJ-021 - Write placement, override honouring, and read parity across the command families

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, AC-F6-1 (override clause), DM-3, NFR-1, RSK-2, §8.5
**Evidence Class**: Suite + revert (P1)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-state-placement.test.ts`
**Tags**: @backend, @state, @cli

**Preconditions**:

- One real checkout with a committed baseline and a seeded change folder (the pilot-style fixture pattern), one temporary host root `H`, recording spawn runner (completed session), refusing credential port, fixed clock and run id.
- **The temporary home is a distinct directory from `H`** (for example `<base>/home-<label>` vs `<base>/host-<label>`), and `<PREFIX>_STATE_DIR` is set to `H` as an absolute path. This is what makes "honours the override" observable: if `HOME === H`, a store that ignored the override would still land under `H` and the assertion would pass vacuously.
- A pre-run listing of `H` and of `<home>/<stateDirectoryName>` (expected: both empty).

**Steps**:

1. Run `phase complete` for the seeded ref, `queue add` for it, `commit`, and `dispatch` for it — each with the delivered grammar.
2. List every artifact produced under `H`, under `<H>/projects/<key>`, and under the home-default path `<home>/<stateDirectoryName>`.
3. Run `status --json`, `lanes list --json`, `retro --json`, `spend --json` and assert they observe the state written in step 1.
4. Inspect the command audit ledger location produced by the same invocations (the runtime-aware edge's audit store).

**Expected Outcome**:

- Every store artifact produced by step 1 exists under `<H>/projects/<key>`: ledger, header, index, fence, documents (including the phase-state document), the audit chain key, and the dispatch attempt records — each named exactly as the delivered layout names it under workspace `default`.
- **Override honouring:** the home-default path `<home>/<stateDirectoryName>` does not exist and contains no artifact; nothing was written under the home default at all. This is the assertion that proves the production store now honours `<PREFIX>_STATE_DIR` — it fails against today's behaviour, where the override reaches only the audit store.
- **Edge consumption:** the command audit ledger written by the same invocations exists under `<H>/projects/<key>` (not at `H`, not under `<home>/<stateDirectoryName>`), proving the runtime-aware edge resolves the same host root through the policy.
- `H`'s listing after step 1 is exactly `{ host index, projects }` (plus `owner-hold` if the fixture sets one): **no store artifact at the host root** — not even a fence or a lock file.
- Step 3: `status --json` reports the queue entry and the phase position written in step 1; `lanes list` reports the same ref; `retro` reads the sidecar location under the project root (a seeded retro sidecar is visible); `spend` reads the ledger under the project root and reports the seeded spend, not an empty read.
- No command re-creates a store at the host root as a side effect of reading (post-run listing unchanged).

**Notes / Clarifications**:

- The "not even a lock file at the host root" clause matters: a fence or lock written at the old location would make two projects contend for a resource they should not share.
- `retro` and `spend` are included because spec F-6 names them as surfaces that must consume the policy; a change that moved only the main store would leave them reading an empty host-root store and silently report zeros — the failure mode RSK-2 describes.
- The home-default negative (step 2) plus the distinct home (precondition) together carry the override clause of `AC-F6-1` behaviourally. Spec v1.1 recorded that today only the audit seam honours the override and the store stays under the home default (§2.1, §8.5), so this cell is a genuine behaviour change and its pre-change failure is expected rather than a fixture artefact.
- Pre-change (P1) all write sets land at `H` (store) or under the home default (per site), so step 2's "no store artifact at the host root" and the home-default negative both fail immediately.

#### TC-PROJ-022 - MCP and CLI open the identical project root under the override

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, AC-F6-1 (override clause), NFR-9, RSK-2
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-scope-mcp.test.ts` over `tests/fixtures/mcp/**`
**Tags**: @backend, @mcp, @state

**Preconditions**:

- One checkout, one temporary host root `H`, and a temporary home that is a **distinct directory** from `H`; `<PREFIX>_STATE_DIR` is set to `H` as an absolute path.
- The MCP composition is built in-process over the same `cwd`, `homeDirectory`, and environment record as the CLI composition.

**Steps**:

1. Resolve the CLI store identity for the checkout and capture `stateDirectory`.
2. Build the MCP surface for the same checkout and capture the store identity its composition uses.
3. Compare the two `stateDirectory` values, the `workspaceId`, and the schema version.
4. Assert neither resolves to the home-default path `<home>/<stateDirectoryName>` and that path does not exist.
5. Run one status-shaped tool call and compare its payload with the CLI's `status --json` `data` projection for the same checkout.
6. Provoke one classified failure on both surfaces and compare the error identity.

**Expected Outcome**:

- The two `stateDirectory` values are **identical** strings and both equal `<H>/projects/<key>`; `workspaceId` is `default` on both; the schema version is unchanged.
- Step 4: neither surface resolves under the home default, and `<home>/<stateDirectoryName>` was never created — both honour the override, which today neither does.
- Step 5: the tool payload and the CLI projection agree on the values this change touches (state location is not projected by either, which is asserted by its absence from both payloads); no field is added or removed.
- Step 6: the same error code on both surfaces for the same provocation (payload/error parity unchanged).

**Notes / Clarifications**:

- Before the change, `production.ts` and `serve.ts` each compose the same host directory inline and ignore the override; the test's "identical" assertion would pass pre-change for the *host* root, so the revert-sensitive assertions are steps 1–4's equality with `<H>/projects/<key>` and the home-default negative — values that do not exist pre-change.
- A distinct home is required for the same reason as in TC-PROJ-021: with `HOME === H` a store that ignored the override would still land under `H`.
- Parity is asserted in-process because the change does not touch the transport; the MCP wire protocol stays with the existing MCP suites.

#### TC-PROJ-023 - Daemon socket derives from the project root; outside path refused

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-5, AC-F6-4, DM-3
**Evidence Class**: Suite
**Test Type(s)**: Integration + Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-daemon-socket.test.ts` (unit calls into `resolveDaemonSettings`)
**Tags**: @backend, @daemon, @config

**Preconditions**:

- Two registered projects with distinct project roots; the configuration catalog's daemon branch resolved without an explicit `socket-path`.

**Steps**:

1. Resolve daemon settings with `stateDirectory` = project A's root; capture `socketPath`.
2. Resolve with project B's root; capture `socketPath`.
3. Resolve with project A's root plus an explicit absolute `socket-path` outside A's root.
4. Resolve with project A's root plus a **relative** `socket-path`.
5. Resolve with an explicit absolute `socket-path` that is a sibling of A's root but not inside it.

**Expected Outcome**:

- Steps 1–2: the default socket path is `<projectRoot>/<default socket file name>`; the two paths differ because the roots differ; each satisfies the inside-the-state-directory rule (a lexical containment check against the project root, not the host root).
- Step 3: refused with `config.value.invalid` and key `daemon.socket-path`.
- Step 4: accepted and resolved relative to the project root, still inside it.
- Step 5: refused with `config.value.invalid` and key `daemon.socket-path` — the rule is containment in the **project** root, so a path inside the host root but outside the project is refused.
- The resolved socket path never points at the host root, even when the host root is the parent of the project root.

**Notes / Clarifications**:

- Step 5 is the assertion that distinguishes "derived from the project root" from "derived from the host root": a host-root-scoped rule would accept a path beside `projects/`.
- The default socket file name is read from the delivered contracts constant; the test asserts relative placement and containment, not an exact file name string.

#### TC-PROJ-024 - Bash fallback resolves the project root without widening its search

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-5, RSK-10, NG-10
**Evidence Class**: Suite + mutation (P6: widening the search depth instead of resolving the root reds it)
**Test Type(s)**: Structural + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-bash-authority.test.ts` (structural half, extending the existing TC-BASH-005 owner) and a bash-executing half in the same file
**Tags**: @bash, @structure, @dispatch

**Preconditions**:

- A temporary host root `H`, a project root `<H>/projects/<key>` containing a valid authority document saying `authoritative`, and a second temporary host root with the same document placed **at the host root** (the old location).
- The bash resolver is sourced in a subshell (`bash -c 'source scripts/lib/dispatch-authority.sh; dispatch_authority_state'`) with `ADOS_DISPATCH_STATE_ROOT` set to the host root, `ROOT_DIR` set to the checkout, and `DISPATCH_REPOSITORY` set to the normalized repository key.

**Steps**:

1. Source the resolver text and assert it resolves the project root before locating the document (a declared resolution step that consumes the identity marker / project container), and that the `find` bound is **not** widened (assert the existing `-maxdepth 2` bound remains and no `-maxdepth 3` or deeper appears, and that any `find` is scoped to the resolved project root).
2. Run the resolver against the migrated layout: document under `<H>/projects/<key>/`.
3. Run it against the old layout: document only at the host root.
4. Run it with `ADOS_DISPATCH_STATE_ROOT` unset and `ROOT_DIR/.ai/local/state` populated (precedence cell).
5. Run it with no project state root at all.

**Expected Outcome**:

- Step 1: the resolver contains a project-root resolution step and no widened depth; the assertion names the offending line if a `-maxdepth 3+` appears.
- Step 2: `authoritative`.
- Step 3: `dual-run` — the old location is **not** consulted, and the read does not become a host-root scan.
- Step 4: the `ROOT_DIR`-local root still wins over the home default (environment-override precedence unchanged).
- Step 5: `dual-run`, exactly as before.
- No branch of the resolver invokes the typed CLI, the network, or a model (the existing forbidden-call scan stays green).

**Notes / Clarifications**:

- Step 3 is the anti-compensation assertion: an implementation that "fixed" the fallback by walking three levels deep would find the document under `projects/<key>/` *and* would also pick up the host-root document, so it fails here. RSK-10 names exactly this failure.
- The mutation P6 replaces the project-root resolution with `-maxdepth 3`; step 3 and step 1 must then red while steps 2, 4, 5 stay green.

#### TC-PROJ-025 - Owner hold stays host-wide across projects

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-7, DEC-9, RSK-9
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-owner-hold.test.ts`
**Tags**: @backend, @cli, @owner-hold

**Preconditions**:

- Two registered projects under one temporary host root; the owner-hold marker written at the **host root** with the delivered marker name and payload shape; no marker inside any project root.
- A second sub-case with the brand-derived environment override set (for example `<PREFIX>_OWNER_HOLD`) and the marker present.

**Steps**:

1. With the host-root marker present, run `status --json` and `queue plan --json` inside each checkout.
2. Remove the host-root marker; run the same commands.
3. Place a marker **inside** project A's root only (no host-root marker); run the same commands in both checkouts.
4. With the host-root marker present, set the environment override to the "released" value; run the same commands.

**Expected Outcome**:

- Step 1: both checkouts observe the hold as active (the delivered owner-hold evidence in `status` and the hold gating in `queue plan`), and both name the same source/location in their evidence.
- Step 2: neither observes a hold.
- Step 3: **neither** checkout observes a hold — a per-project marker has no effect, proving the read is host-root only (DEC-9).
- Step 4: the environment override outranks the marker exactly as before (hold released despite the marker) — asserted for **both** projects, so the precedence is not project-specific.
- No code path reads `<projectRoot>/<owner-hold marker name>`: asserted by the step 3 result and by the structural consumer list in TC-PROJ-020.

**Notes / Clarifications**:

- The hold is a stop-all control; the failure this test prevents is a silent narrowing (RSK-9). Step 3 is the direct assertion that no narrowing happened.
- `status` and `queue plan` are used because they are the delivered surfaces that project the hold; the test asserts the semantic outcome (hold active/observed), not a private field.

#### TC-PROJ-026 - Migration preserves bytes, modes, audit chain, and retro sidecar; inverse move restores

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-3, DM-7, NFR-7, DEC-11, RSK-1
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-migration.test.ts` over `tests/fixtures/state/harness.ts`
**Tags**: @backend, @state, @migration

**Preconditions**:

- A **populated pre-migration store at the host root**, built entirely through the delivered APIs: an audit chain with at least three verified pairs (`seedAuditPairs`/`appendAuditFacts`), a phase-state document, a queue entry, the audit chain-key artifact, the retro evidence sidecar plus its lock and the retro chain key, a quarantine artifact, and the header/index/fence artifacts created by opening the store.
- A snapshot `S0`: for every file under the host root — relative name, sha256, mode, and whether it is a directory; plus the functional reads: the phase document value, the queue entry, the audit chain verdict, the retro registry verdict, and one audit read.
- The checkout is registered so its project key and project root are known.

**Steps**:

1. Capture `S0` and the five functional reads against the host-root store.
2. Perform the documented one-step move: rename every store artifact from the host root into `<H>/projects/<key>/` (same names, same modes), leaving the owner-hold marker and the host index at the host root.
3. Capture `S1` of the project root and re-run the five functional reads against a store opened at the project root.
4. Compare `S0` (renamed to the project-root prefix) with `S1`.
5. Perform the inverse move back to the host root; capture `S2` and re-run the reads against the host-root store.

**Expected Outcome**:

- Step 3: every artifact exists under the project root with the **same relative name**, the **same sha256**, and the **same mode** (`0600` for store-managed files, `0700` for directories); the project root itself is `0700`.
- Step 3: the audit chain still verifies (`verifyAuditChain` returns the verified verdict, not a torn or unknown one); the retro sidecar still reads and its registry verdict is unchanged; the phase document, the queue entry, and the audit read return values identical to step 1.
- Step 4: the comparison is exact — zero byte differences, zero mode differences, zero missing or extra artifacts; a content rewrite of any artifact would fail this even if the reads happened to succeed.
- Step 5: `S2` is identical to `S0` and all five reads succeed again at the host root; the host root after step 5 contains the same file set it had before step 2.
- Between steps 2 and 3, the host root contains **no** store artifact: its listing is exactly `{ host index, projects, optionally owner-hold }`.

**Notes / Clarifications**:

- "Byte-identical" is asserted by digest per file, not by spot-checking the ledger: a header or an index artifact that was silently rewritten (for example re-encoded) would pass a ledger-only check.
- Modes are compared because migration must not weaken least privilege (§20): moving a `0600` file must not produce `0644`, and the new project root must be `0700` like the host root.
- The inverse move is part of the criterion, not a convenience: it is the only assertion that nothing was rewritten into a form the old layout cannot read.
- The retro sidecar's *lock* file and *chain key* move with the sidecar; a migration that moved only the `.jsonl` would pass a "retro reads" test if the key were regenerated — the digest comparison forbids regeneration.

#### TC-PROJ-027 - Legacy detection warns once and moves nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, G-7, RSK-1
**Evidence Class**: Suite + mutation (P7: removing the detection reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-migration.test.ts`
**Tags**: @backend, @state, @migration

**Preconditions**:

- An **unmigrated** host: store artifacts at the host root, the checkout registered or not, and the checkout's project root **absent**.
- A second, **migrated** host fixture: the same checkout with its artifacts already under the project root.
- Byte snapshots of both host roots before each run.

**Steps**:

1. Run `status --json` inside the checkout on the unmigrated host; capture exit, envelope, stderr verbatim, and both host-root snapshots.
2. Count occurrences of the migration-note reference in stderr.
3. Run the same command on the migrated host; capture stderr.
4. Run a second state-opening command on the unmigrated host in the same process lifetime (to prove the warning is per invocation and not cumulative noise).

**Expected Outcome**:

- Step 1: exit `0`; the command's own envelope is unaffected (no new error, no changed `data`); **exactly one** warning appears on stderr and it names the migration note (by the delivered note path or title, resolved from a single shared constant, not duplicated prose).
- Step 1: nothing is moved and nothing is deleted — every pre-existing host-root artifact is byte-identical and still present; the only new path is the project root, and it contains no migrated artifact (it may contain a newly created empty store).
- Step 1: the exit code equals the exit code the same command produces on the migrated host (`0`) — the warning never changes an exit code.
- Step 2: the count is exactly `1` (not `0`, not one per command family, not repeated per artifact).
- Step 3: the count is `0` on a migrated host.
- Step 4: the warning appears once per invocation (no accumulation, no suppression after the first).

**Notes / Clarifications**:

- Mutation P7 removes the detection branch; this test must then red at step 2 with a count of `0`.
- "Nothing moved" is asserted by digest, not by listing: a move that preserved names but rewrote content (for example by re-serializing) would pass a name check.
- The single shared constant for the note's path is what keeps the warning and the note from drifting; the test asserts the reference, not the sentence.

#### TC-PROJ-028 - Migration note content, distribution class, and registration

**Scenario Type**: Documentation
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-7, F-10, AC-F8-3, §16.1, §19, §8.5 (override relocation)
**Evidence Class**: Review-verified (content); Suite (distribution marker and registry presence)
**Test Type(s)**: Manual + Structural
**Automation Level**: Semi-automated
**Target Layer / Location**: the new guide under `doc/guides/`, plus the suite half in `bash scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @review, @migration

**Preconditions**:

- The migration note exists as a delivered guide; the forbidden-literals registry names it in the user-facing-docs scope.

**Steps**:

1. **Suite half:** the note's front matter declares `ados_distribution: redistributable`; the note is registered in `scripts/checks/forbidden-literals.registry.json` under the user-facing-docs scope; `bash scripts/.tests/test-doc-distribution.sh` is green.
2. **Review half:** read the note against the six required statements and record each with its location.

**Expected Outcome**:

- Suite: the distribution marker, the registry presence, and the distribution drift guard are all green.
- Review, with each item quoted in §10:
  1. the primary-checkout designation and why (no record carries repository attribution);
  2. the fresh-start consequence for every other checkout;
  3. owner-hold continuity — the marker stays at the host root and keeps holding every project;
  4. the declared out-of-checkout `unbound` scope and the expectation that delivery commands run inside a checkout;
  5. the reversal step (move the artifacts back) and the statement that the move rewrites nothing.
- The note also states what the host root override means after the change — required by spec §19 and §8.5: an absolute `<PREFIX>_STATE_DIR` names the host root, project roots derive beneath it, and because the **store begins honouring the override in this change** (until now only the audit seam did), an operator who already set the override has existing store state under the home default and must move that store's contents into the derived project root under the override.
- The note does not present migration as automatic, and it names the artifact set explicitly (RSK-1's residual-risk mitigation).

**Notes / Clarifications**:

- Six statements are enumerated here so the review is a checklist rather than an impression; a note that omits the fresh-start consequence would be technically accurate and operationally dangerous.
- The override statement is the one the spec added in v1.1 (§8.5 "State-scope override", §19 "Host root override"): it is the only durable place where an operator learns that setting the override now relocates the delivery store, so its absence would be an evidence gap even though the code is correct.
- The suite half is genuinely automated (marker + registry + drift guard); only the prose content is review-verified, which is the split the spec's own evidence class for AC-F8-3 permits.

#### TC-PROJ-029 - `projects` is reachable from the built help surface with no side effects

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, G-8, RSK-11
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-help.test.ts` (in-process `runEntrypoint`) plus one subprocess cell against `packages/cli/bin/delivery-os.ts`
**Tags**: @backend, @cli, @help

**Preconditions**:

- A temporary home and a temporary host root that **does not exist yet** (so any creation is observable); a `cwd` outside every git work tree.
- The workspace is built (`pnpm build`) for the subprocess cell, because the bin imports package subpaths that resolve to `dist`.
- Recording seams: a throwing config resolver, a recording git child runner, a throwing network transport, and a throwing daemon factory.

**Steps**:

1. In-process: run the entrypoint with `["--help"]`, `["projects","--help"]`, `["projects","list","--help"]`, `["--version"]`.
2. Assert the root listing contains `projects` among the families, and each command help names `projects` (and `list` for the family/verb pages).
3. Assert every seam recorded zero calls (no config read, no git spawn, no transport, no daemon construction).
4. Assert the host root still does not exist and the temporary home is empty after all four runs.
5. Subprocess: spawn `bun packages/cli/bin/delivery-os.ts --version` and `bun packages/cli/bin/delivery-os.ts projects --help` with the same environment; assert exit `0` and non-empty stdout, and the same absence of created state.

**Expected Outcome**:

- All four in-process invocations exit `0`; stdout is non-empty and contains the expected command names; no usage error is printed.
- Step 3: every recording seam reports zero calls — help and version are served from the static inventory and read no state, git, configuration, or network.
- Step 4: the host root does not exist and the temporary home is empty: the help path writes nothing.
- Step 5: both subprocess invocations exit `0` and produce the same content class as the in-process runs; no state directory is created under the temporary home.

**Notes / Clarifications**:

- This is the assertion that closes the board-family failure mode (F-9, RSK-11): a family that is composed but not prompt-required is dropped by the entrypoint's restriction step, so `--help` would not list it. Step 2 detects that directly.
- The subprocess cell exists because the prompt-required restriction and the drop-everything-else rule run in the real process path; the in-process cell is what can observe the seam counters.

#### TC-PROJ-030 - Help-coverage, reference-page parity, and inventory registration

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DEC-13, G-8
**Evidence Class**: Suite (tree half) + Review-verified (M1-pages-unmodified half)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/checks/help-guide-coverage-mutants.test.ts`, `tests/fixtures/help-guide/coverage.json`
**Tags**: @backend, @docs, @gates

**Preconditions**:

- The coverage inventory declares `projects` in `commands` and registers its page in `referencePages`; the parity gate resolves a per-command reference page root so the M2 page serves the M2 command.

**Steps**:

1. Run `runHelpGuideCoverage()` and assert zero failures.
2. Run the reference-page parity suite and assert zero failures.
3. Assert the inventory's `commands` set equals `PROMPT_REQUIRED_COMMANDS` (including `projects`).
4. Assert the parity map resolves `projects` to the M2 command page, and that the page contains both `--help` and `--version`.
5. Assert the mutants suite still detects a removed inventory row and a page missing `--version` (the gates stay live).
6. **Review:** diff the M1 milestone snapshot pages and record that none changed.

**Expected Outcome**:

- Steps 1–2: both gates green via `pnpm check:help` and the parity test.
- Step 3: set equality, not containment — an inventory that lists `projects` while `PROMPT_REQUIRED_COMMANDS` lacks it (or vice versa) fails.
- Step 4: the resolved page path is the M2 page under the declared per-command root; it contains `--help` and `--version`; the page is registered in `referencePages`.
- Step 5: the mutation probes still report the seeded failure by name, so a green gate means something.
- Step 6: the recorded diff shows zero changes to `doc/planning/oss-tooling/milestones/m1/**`.

**Notes / Clarifications**:

- Step 6 cannot be a permanent suite: asserting "the M1 pages are unmodified" is a diff against a moving base, which `.ai/rules/testing-strategy.md` forbids in permanent suites. The tree-invariant half (gates green, membership, page content) is automated and the diff half is recorded in §10 and the review verdict — see OQ-T3.
- Step 5 is what keeps the gates honest: a gate that passes on any input is worse than no gate because it advertises coverage it does not provide.

#### TC-PROJ-031 - Exactly three error rows under one new domain kind, documented both ways

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-3, DM-6, G-8
**Evidence Class**: Suite (rows) + Review-verified (unchanged-row half)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `packages/core/src/contracts/error-table.ts`, `doc/spec/features/feature-result-contract.md`
**Tags**: @backend, @docs, @errors

**Preconditions**:

- `DOMAIN_KINDS` gains exactly one new member (`projects`); `ERROR_TABLE` gains exactly three rows.

**Steps**:

1. Assert `DOMAIN_KINDS` contains `projects` exactly once and that no other kind was added, removed, or renamed (compare against the pinned kind list in the existing suite's fixture).
2. Assert exactly three rows have `domainKind === "projects"` and that their codes are exactly `projects.identity-unreadable`, `projects.registry-corrupt`, `projects.state-unavailable`.
3. Assert every one of the three rows carries all declared fields (code, domainKind, category, retryable, consequence, remediation, projection class) and that each is reachable from the family's paths (the refusal/state projection classes match TC-PROJ-013's observations).
4. Run the bidirectional sync check (`runSyncCheck`) and the sync suite; assert green.
5. Assert the result-contract spec contains all three rows with matching categories and retryability, and that the documented identity count grew by exactly three.
6. **Review:** diff the error table and the result-contract spec and record that no pre-existing row was added, retired, reworded, or reordered.

**Expected Outcome**:

- Steps 1–3: one new kind, three rows, complete field sets, projection classes consistent with the observed exits in TC-PROJ-013.
- Step 4: the sync gate is green in both directions (a row without documentation and documentation without a row each fail).
- Step 5: the documented rows agree with the table on category and retryability, and the total count is the pre-change count plus three.
- Step 6: the recorded diff shows changes only in the new kind's block.

**Notes / Clarifications**:

- The bidirectional gate is the reason this is a suite rather than a review: `scripts/checks/error-table-sync.ts` reads both the table and the doc, so a mismatch fails without a human noticing. The "no existing row touched" half is inherently a diff and belongs to review.
- "Exactly three" is asserted as an exact count of the new kind *and* an exact code set, so adding a fourth `projects.*` code as a convenience fails.

#### TC-PROJ-032 - No new hardcoded product or binary literal

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-4, NFR-10
**Evidence Class**: Suite
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-literals.test.ts`, `scripts/checks/forbidden-literals.registry.json`
**Tags**: @backend, @structure, @branding

**Preconditions**:

- The full-scope forbidden-literal scan and the privacy-literal scan are the delivered gates; the new guide is registered in the registry's user-facing-docs scope.

**Steps**:

1. Run `scripts/checks/forbidden-literals.ts` and `scripts/checks/privacy-literals.ts`; assert both green.
2. Assert the registry's scope list and seed set are unchanged, and that the new migration note was registered rather than exempted.
3. Assert the new `projects` command help text, the new identifier names, and the new reference page contain no seed literal and no hardcoded binary name; the command name comes from a single declaration.
4. Assert the branding seam's `stateDirectoryName` consumer list names the host root (review, recorded with the AC-F10-1 evidence).

**Expected Outcome**:

- Both scans are green with the seeds unchanged (no seed was removed to make the change pass).
- No new file under `packages/**` or the new docs contains `ados`, `ADOS_`, `~/.ados`, or a literal binary name; the CLI's naming comes from the brand identity seam.
- The registry diff shows exactly one addition (the migration note), no scope change, and no allowlist entry added for a shipped source file.

**Notes / Clarifications**:

- NFR-10 also forbids new dependencies and workspace packages; that half is asserted by the unchanged lockfile and the release suite (TC-PROJ-035) plus the boundary checks in the gate battery, not duplicated here.
- Adding an allowlist entry to silence a hit is the failure mode this test guards against, so the registry diff is part of the evidence.

#### TC-PROJ-033 - System-spec reconciliation

**Scenario Type**: Documentation
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, §16.1
**Evidence Class**: Review-verified (+ suite for page presence)
**Test Type(s)**: Manual + Structural
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/**`; the review verdict and §10 carry the evidence (no suite asserts prose meaning)
**Tags**: @docs, @review

**Preconditions**:

- The change is complete; the five edited system-spec pages and the new `feature-projects.md` exist.

**Steps**:

1. **Review:** confirm the new feature page exists, is reachable from the documentation index, and carries the surface coverage listed below.
2. **Review:** assert each edited page states its required fact.

**Expected Outcome**:

- `feature-state-layer.md` states the two-layer root (host root plus project root) and names the host index as the only host-level document.
- `feature-cli-entrypoint.md` lists `projects list` in the prompt-required set and states the two-layer resolution.
- `feature-branding-seam.md` states that `stateDirectoryName` names the host root.
- `feature-dispatch-engine.md` states that the authority document is read under the project root and that the shell fallback resolves that root.
- `feature-owner-gate-sla.md` states that the hold is host-wide and read at the host root.
- `feature-projects.md` exists and covers `projects.v1`, the envelope and text contract, exit codes, the three error identities, discovery and pruning, the handover and daemon projections, and the identity marker.

**Notes / Clarifications**:

- Each claim is recorded in §10 with the page and the quoted sentence, so the review evidence is checkable rather than asserted.
- No suite asserts this content, and none is claimed to: prose meaning is not testable, and a presence-only test would advertise coverage it does not provide. The repository has no doc-index assertion that this page could ride, so the whole criterion is review-verified, matching spec §17.
- The new **module** inventory rows (a new core module and the adapter seams) are separately suite-covered by `tests/structure/content-inventory.test.ts`; that is a different obligation (§16 "Structural inventories") and is listed under TC-PROJ-036.

#### TC-PROJ-034 - Planning-corpus reconciliation

**Scenario Type**: Documentation
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, AC-F10-2, §16.1, G-8
**Evidence Class**: Review-verified
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/**`
**Tags**: @docs, @review

**Preconditions**:

- The change is complete.

**Steps**:

1. Read each corpus file against its required change.

**Expected Outcome**:

- `backlog.md`: the M2-S11 entry records the delivery (its progress markers reflect the delivered state).
- `status.md`: one M2 delivery snapshot entry, shaped per the file's own maintenance convention (not invented here).
- `cli-command-registry.md`: the `projects` row moves from planned to delivered, naming this change.
- `milestones/m2/entrypoint-delta.md`: the observed composition gains `projects`; the remaining M2 additions stay planned.
- `milestones/m2/commands/projects.md`: keeps the pack's proposed status header, gains the `--help`/`--version` contract, documents `daemonReachable` as `{ reachable, reason? }` with the closed vocabulary, documents `projects.state-unavailable` as present-but-unreadable or unestablishable, and states that listing is read-only.
- `milestones/m2/README.md`: only if the pack index needs the status note adjusted; the planned-until-exit semantics stay.

**Notes / Clarifications**:

- The pack's status semantics are a trap: "delivered" must not be written where the pack says "planned until M2 exit". The command page therefore keeps `Status: Proposed (M2)` while the entrypoint delta records the observed composition — that asymmetry is correct, and the review must record that it was deliberate.
- The status snapshot's *shape* is governed by that document's own convention, so this plan does not prescribe a row format.

#### TC-PROJ-035 - Release changeset shape

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-3, DEC-15, NFR-10
**Evidence Class**: Suite (existing — no new test)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-release.test.ts` (TC-RELEASE-001/002), `scripts/checks/changesets-group.ts`
**Tags**: @backend, @release

**Preconditions**:

- The delivery adds exactly one changeset; `origin/main-tools` is reachable in the git work tree (the suite's declared base anchor).

**Steps**:

1. Run `bun test tests/checks/privacy-release.test.ts`.
2. Run `bun run scripts/checks/changesets-group.ts`.
3. Assert the new changeset lists exactly the five fixed-group packages at `minor` and carries a non-empty body describing the state-root scoping, the `projects` family, the migration step, and the mount obligations.

**Expected Outcome**:

- Exactly one changeset is added relative to the merge base; every pre-existing changeset is byte-identical; no pre-existing changeset is modified or deleted.
- The added changeset lists exactly `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode` at `minor`, excludes `@delivery-os/testkit`, and has a non-empty body.
- No package manifest version changed; the lockfile is unchanged; `changesets-group` is green.
- The changeset body is accurate: it states that delivery state now lives under a per-repository root, that existing installs must perform the one-step move, and that delivery commands are expected to run inside a checkout (spec §18 communication).

**Notes / Clarifications**:

- This suite already exists and already anchors on the merge base and tolerates a growing population (it asserts non-vacuity rather than a fixed count). This plan adds nothing: duplicating it would create two owners of one invariant.
- The body's accuracy is review-verified inside this TC; it is not assertable.

#### TC-PROJ-036 - State contract preserved and existing suites green unmodified

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, NFR-10, NG-1, §8.5
**Evidence Class**: Suite + Review-verified
**Test Type(s)**: Structural + Review
**Automation Level**: Semi-automated
**Target Layer / Location**: existing `tests/structure/state-contract.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/content-inventory.test.ts` (module inventory rows), `tests/structure/audit-*`, `tests/behaviour/audit-chain*.test.ts`, `tests/behaviour/retro-*.test.ts`, `tests/golden/**`
**Tags**: @backend, @state, @regression

**Preconditions**:

- The change branch, with the new suites added and **no** existing state/audit/retro test edited.

**Steps**:

1. Run the existing state, audit, retro, and module-inventory suites unmodified; assert green.
2. Assert the store artifact name constants, the schema version, the record kinds, the key prefixes, and the layout module are byte-identical to the pre-change tree.
3. Assert the module inventory gained exactly the rows the new modules require (§16 "Structural inventories and release artifacts") and nothing else.
4. **Review:** the diff contains no change under `packages/core/src/state/**` except the paths this change legitimately touches (which the plan names); record every touched file and why.

**Expected Outcome**:

- All existing state/audit/retro/inventory suites are green with **zero** edits to those test files (asserted by the review diff, not by a test).
- `STATE_SCHEMA_VERSION`, the artifact name constants, `QUEUE_ENTRY_KEY_PREFIX`, the phase-document name pattern, and the retro artifact prefixes are unchanged.
- The module inventory's delta is exactly the new module rows; a removed or renamed row fails the suite by name.
- The golden suites (`queue-*`, `status-*`, `retro-*`) are unchanged and green: the change moves a directory, it does not rewrite a projection.

**Notes / Clarifications**:

- "Existing suites green without modification" is the operational form of NFR-2: if a state suite had to change, the change altered the contract. The review's diff of `tests/**` is the evidence; the suite run alone cannot distinguish "green because unchanged" from "green because the test was edited".
- NG-1 makes this a non-negotiable gate: adding a record kind to carry the project key would be the tempting shortcut, and this TC is what makes it visible.

#### TC-PROJ-037 - Bounded work: latency, maintenance cost, read/write counts, no crawl

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, G-3, DEC-4
**Evidence Class**: Suite (measurement) with recorded wall-clock in §10
**Test Type(s)**: Integration + Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-performance.test.ts` and a structural assertion in `tests/structure/projects-state-scope-policy.test.ts`
**Tags**: @backend, @performance, @projects

**Preconditions**:

- **25-project cell:** 25 real checkouts, each with a materialized project root containing a real store with one queue entry and one handover record (so the per-project reads are not trivially empty).
- **200-project cell:** an index with 200 entries and 200 materialized empty project roots; the index's revision is recorded.
- A counting index seam (index reads and writes per invocation) and a counting filesystem edge that records every directory enumeration.
- A warm-up run before measurement so module and page caches are populated.

**Steps**:

1. Run `projects list` and `projects list --json` 10 times each over the 25-project index; record p95 for each.
2. Run both over the 200-project index; record p95.
3. Measure the maintenance step alone: time a state-opening invocation inside a checkout with the index at revision `n`, with the maintenance call wrapped by the counting seam.
4. Assert the per-invocation index read/write counts.
5. Assert that no `readdir` occurs outside the host root's own entries and the resolved project root (a bounded set), using the counting edge.
6. Assert the 200-project list still reports `data.hostIndexRevision` equal to the seeded revision and `data.projects.length === 200`.

**Expected Outcome**:

- p95 (25 projects, text and JSON): ≤ 500 ms.
- p95 (200 projects, text and JSON): ≤ 4 s.
- Maintenance p95: ≤ 10 ms.
- Per state-opening invocation: index reads ≤ 1 and index writes ≤ 1.
- Directory enumerations: bounded to the host root's declared entries and the resolved project root; no enumeration of `projects/` children beyond the entry being served, and no crawl of the filesystem outside the host root.
- Step 6: revision and length match the seeded index — the measurement is of the real read path, not of a short-circuit.
- Recorded wall-clock values are written to §10 as informational evidence (a regression in absolute numbers is visible even when the threshold holds).

**Notes / Clarifications**:

- p95 over 10 samples is a floor, not a statistical claim; the point is that no cell is pathologically slow and that the counts are bounded. The plan states the sample count and the warm-up so the numbers are reproducible.
- The "no crawl" assertion is structural as well as runtime: the host-index module must not contain a recursive directory walk, asserted by AST. A counting edge proves the current path; the AST assertion prevents a future one.
- The 200-project cell seeds the index rather than creating 200 repositories; that is declared in §1.2 and mitigated by step 6's revision/length assertions.

#### TC-PROJ-038 - Test isolation: guard, leak detector, no real-state writes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-8, RSK-12
**Evidence Class**: Suite
**Test Type(s)**: Checks (mutation-tested guard)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/projects-test-isolation.test.ts` over `tests/fixtures/projects/state-scope.ts`
**Tags**: @backend, @isolation, @safety

**Preconditions**:

- A new fixture module `tests/fixtures/projects/state-scope.ts` exposing the approved base, the host-root factory, the home factory (which returns a directory **distinct** from the host root), `guardStateFixtureRoot(dir)`, and `realStateFingerprint(brand)`.

**Steps**:

1. **Guard passes** for a directory under the approved base and for a directory under the OS temp root that is not inside the repository.
2. **Guard throws** for the live workspace root (`process.cwd()`), for any ancestor of it, and for the real state directory derived from `os.homedir()` plus the brand's state directory name — each with a message naming the rejected path.
3. **Guard throws** for a path outside both the approved base and the OS temp root.
4. **Leak detector:** capture `realStateFingerprint(brand)` (a listing of names, sizes, and mtimes, or an "absent" sentinel) before and after running a representative projects suite; assert equality.
5. **Meta-assertion:** every new projects suite and every new projects fixture calls the guard before composing; an AST/text scan names any file that opens a store without it.
6. Assert the aggregate gate is run with the repository-local temp directory (`TMPDIR=$PWD/tmp/tmpdir`, created if missing) and that a fixture requiring "outside any work tree" uses the delivered non-checkout fallback rather than assuming `tmpdir()` is outside the repository.
7. **Home-distinctness meta-assertion:** every suite that asserts override honouring or store placement creates a home that is a distinct directory from its host root (asserted on the fixture's own factory: `home !== hostRoot` and neither is an ancestor of the other). This prevents a `HOME === hostRoot` fixture from masking a store that ignores the override.

**Expected Outcome**:

- Steps 1–3 produce the exact pass/throw split; the guard is proven live by its own negative controls (a guard that always passes would fail step 2).
- Step 4: the fingerprint is unchanged, including the "absent" case where the real state directory does not exist on the machine.
- Step 5: zero unguarded suites; the scan names any offender.
- Step 6: the gate command recorded in §7 and §10 includes the `TMPDIR` override, and no fixture creates a temporary directory without first proving it is outside every git work tree (needed because `TMPDIR` points inside the repository under the gate).
- Step 7: the factory cannot produce a home that equals the host root, so the override-honouring cells in TC-PROJ-021/022 cannot pass vacuously.

**Notes / Clarifications**:

- The fingerprint is read-only and compares a *snapshot*, so it is valid on a developer machine that already has a populated real state directory — which is precisely the machine a leak would damage (RSK-12).
- The guard's "not an ancestor of the workspace" clause is the mirror of `tests/fixtures/watchdog/temp-git.ts`'s `guardFixtureRoot`; both exist because a destructive-adjacent teardown must never target the checkout it runs in.
- Step 6 is the `TMPDIR` trap made explicit: with `TMPDIR=$PWD/tmp/tmpdir`, `tmpdir()` is *inside* the repository and `findGitRoot` ascends into this repo's own `.git`. Fixtures that need "outside any work tree" must therefore use the GH-273 fallback, and fixtures with their own `.git` are unaffected because the nearest enclosing root wins.

#### TC-PROJ-039 - Revert and mutation evidence bundle (P1–P7)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F2-1, AC-F2-4, AC-F2-5, AC-F4-2, AC-F4-3, AC-F6-2, AC-F6-5, AC-F8-2, NFR-4 evidence discipline, spec Appendix D
**Evidence Class**: Review-verified (manual procedures; evidence recorded in the change review and §10)
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: no committed test; the procedures are executed on a scratch tree and recorded
**Tags**: @review, @regression

**Preconditions**:

- A green tree with all new suites passing; a clean working tree (or a scratch commit) so each artifact can be reverted or mutated and restored; never run in CI.
- The seven procedures are distinguished up front and are **never merged**: P1 two-layer resolution, P2 absent-index-as-corrupt, P3 prune-deletes-state, P4 trust-recorded-location, P5 `in-transition` unreachable, P6 shell-fallback depth widening, P7 legacy-detection removal. Each changes exactly one artifact.

**Steps and expected red sets**:

1. **Baseline.** Run the new suites; record the pass set.
2. **P1 — two-layer-resolution revert.** In the production composition (the module the plan names as the state-scope resolution site), restore the single host-root resolution exactly as it is delivered today: compose the store directory inline as `<home>/<brand.stateDirectoryName>` (ignoring the override) and open the store there, leaving every other file untouched. Run the isolation, placement, and identity suites.
   *Red:* TC-PROJ-001 (both checkouts collide), TC-PROJ-021 (artifacts at the host root, the home-default path created, and the audit ledger no longer under the project root), TC-PROJ-022 (CLI and MCP no longer agree on `<H>/projects/<key>`; both fall back to the home default), and TC-PROJ-020's single-site assertion in the opposite direction (the inline derivation reappears in the CLI tier). *Green:* TC-PROJ-014/015/016/017/018/019 (projections read whatever root the fixtures seed), TC-PROJ-026/027 (migration tests open stores directly at given paths), TC-PROJ-030/031/032/035, TC-PROJ-038.
3. **P2 — absent-index-as-corrupt mutation.** In the host-index reader, return the corrupt result when the index file is absent. Run the host-index suite. *Red:* TC-PROJ-006 step 2 (expects exit `0`, empty list, revision `0`). *Green:* TC-PROJ-008 (its index is present and corrupt), the rest.
4. **P3 — prune-deletes-state mutation.** In the maintenance pruning step, delete the referenced project state root when an entry is provably dead. Run the host-index suite. *Red:* TC-PROJ-009 step 3 (the "byte-identical, nothing deleted" assertion). *Green:* TC-PROJ-006/007/008/010.
5. **P4 — trust-recorded-location mutation.** In the row projection, report the index's recorded `stateLocation` instead of the derived one. Run the host-index and list-contract suites. *Red:* TC-PROJ-010 step 4 (reports the injected path and, in the same run, the assertion that the injected path was never created). *Green:* TC-PROJ-011/012/013.
6. **P5 — `in-transition` unreachable mutation.** In the handover projection, return `shell` for every disagreement. Run the handover suite. *Red:* TC-PROJ-015 (all four disagreement cells) and TC-PROJ-016 step 1 (the biconditional). *Green:* TC-PROJ-014 (the agreeing cells) and every non-handover suite.
7. **P6 — shell-fallback depth widening.** In `scripts/lib/dispatch-authority.sh`, replace the project-root resolution with a widened search (`-maxdepth 3` over the host root) and leave everything else untouched. Run the bash-authority suite. *Red:* TC-PROJ-024 step 1 (declared resolution step absent / depth widened) and step 3 (the old-location document is now consulted). *Green:* steps 2, 4, 5 of TC-PROJ-024.
8. **P7 — legacy-detection removal.** Remove the legacy-detection branch from the production composition. Run the migration suite. *Red:* TC-PROJ-027 step 2 (warning count `0`, expected `1`). *Green:* TC-PROJ-026 and every other suite.
9. After each procedure, restore the artifact and re-run the affected suites; record the restored green run.

**Expected Outcome**:

- Each procedure reds exactly the named set and leaves the named green set green; every deviation is recorded and investigated rather than normalized.
- The red sets are attributable to one artifact each: P1 and P2 never share a red, P5 never reds TC-PROJ-014, P6 never reds any non-bash test.
- The restore after each procedure returns the full suite to green.

**Notes / Clarifications**:

- This is deliberately not a permanent suite: a test that rewrites shipped source during its own run violates test isolation and would be unsafe in CI.
- Evidence ownership: P1 → AC-F1-1, AC-F6-2; P2 → AC-F2-1; P3 → AC-F2-4; P4 → AC-F2-5; P5 → AC-F4-2, AC-F4-3; P6 → AC-F6-5; P7 → AC-F8-2.
- The exact file paths are the delivery plan's to name; this plan names the artifact by role so the procedure stays valid if a module is renamed during delivery, and requires §10 to record the concrete path actually reverted.

## 6. Environments and Test Data

**Runtime.** Local Linux/macOS or CI, Bun per `.bun-version`, `bun test` / `pnpm test`. No network, no provider credentials, no model process, no resident daemon. `git` is required by the identity/isolation/worktree/clone/migration suites (real repositories), and a missing `git` fails those suites loudly.

**Temp layout and the `TMPDIR` trap.**

- The approved base is declared once in `tests/fixtures/projects/state-scope.ts` as `PROJECTS_TEMP_BASE` — the repository-local `tmp/tmpdir` tree (git-ignored), created recursively on first use. Every projects fixture takes its base from that single constant so no suite can invent a different root.
- The aggregate gate runs with a repository-local temporary directory: `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check` (the delivered convention; `tmp/` is git-ignored). Every fixture that calls `mkdtempSync(tmpdir(), …)` therefore lands **inside** this repository's working tree when the gate runs.
- Consequence one: a fixture with its own `.git` is still fine — `findGitRoot` returns the nearest enclosing `.git`, which is the fixture's.
- Consequence two: a fixture that must be **outside every git work tree** (the `unbound` cell) must use the delivered GH-273 fallback: try `mkdtempSync(tmpdir())` and, when `findGitRoot` still resolves, fall back to a directory under the repository's **parent**; assert `findGitRoot(...) === undefined` before composing and fail loudly otherwise (`tests/fixtures/projects/state-scope.ts` owns this helper).
- Consequence three: no fixture may assume the OS temp root is outside the repository, and no assertion may depend on a path prefix from `tmpdir()`.

**Host-root and home injection (the isolation contract).**

- Every suite creates a per-test **host root** and a per-test **home**, both under the approved base, and passes them in three consistent ways: `homeDirectory` explicitly on the composition facts, `HOME` in the injected environment record, and the brand-derived state-directory override (`<PREFIX>_STATE_DIR`, computed from the resolved brand identity — the prefix is upper-cased and its trailing underscore collapsed, so the test derives the variable name rather than spelling it) set to the absolute host root.
- **The home is always a distinct directory from the host root**, and neither is an ancestor of the other. This is not cosmetic: an absolute override and a home-plus-brand default would otherwise coincide, so a store that ignored the override would still resolve into the host root and the override-honouring assertions in TC-PROJ-021/022 would pass vacuously. The fixture factory enforces the distinction and TC-PROJ-038 step 7 meta-asserts it.
- The brand is resolved once per suite from the single declared neutral working-name constant already used by `tests/fixtures/queue/production/harness.ts`; no new product or binary literal is introduced by the fixtures (AC-F9-4).
- The fixture guard runs **before** any store is opened and rejects: the live workspace root, any ancestor of it, the real state directory derived from `os.homedir()`, and any path outside the approved base ∪ OS temp root. This mirrors `guardFixtureRoot` in `tests/fixtures/watchdog/temp-git.ts`.
- The leak detector fingerprints the real state directory (names, sizes, mtimes; "absent" as a sentinel) before and after the suite and asserts equality, so a leak fails the suite even on a machine where that directory is already populated.
- Cleanup is `rmSync(recursive, force)` in a `finally`, per fixture; no test leaves a host root or a repository behind.

**Real repositories.**

- `tests/fixtures/projects/temp-repos.ts` (new) creates real repositories: `mkdtempSync` under the approved base, `git init -b main`, fixed identity (`user.email`, `user.name`), one baseline commit, then the checkout shape the cell needs (a second clone from a local bare repo, or a linked worktree via `git worktree add`). It sanitizes the git environment the way `tests/fixtures/pilot/repo.ts` does (`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` to `/dev/null`, fixed author identity, `TZ=UTC`), and pins `GIT_CEILING_DIRECTORIES` to the fixture base so no git command can discover this repository's own `.git`.
- Every repository fixture calls the isolation guard before creating anything.
- Remotes are written into `.git/config` (or created by cloning a local bare repo); no network remote is ever contacted.

**State data.**

- Each suite owns its own host root; a second store handle is opened only to read what the composition wrote.
- Handover cells are seeded through `appendDispatchHandover` and `writeDispatchAuthority` on a store opened at the project root — never by formatting ledger lines by hand.
- Migration fixtures are built entirely through the delivered APIs (`seedAuditPairs`, `createRetroSidecar`, `replaceDocument`, `append`) so the byte snapshot is of genuine artifacts, then moved with plain `rename` per artifact.
- Permission assertions use `statSync(...).mode & 0o777`; `chmod`-based unreadable cases are guarded by `process.getuid?.() !== 0` and are always backed by a filesystem-structural provocation (a regular file where a directory is expected), which behaves identically for any user.

**New fixtures (files to create).**

- `tests/fixtures/projects/state-scope.ts` — approved base, host-root factory, home factory (distinct from the host root by construction), `guardStateFixtureRoot`, `realStateFingerprint`, the non-checkout directory helper, and the brand-resolved state-directory override name.
- `tests/fixtures/projects/temp-repos.ts` — real repository factory, clone factory, linked-worktree factory, nested-repository factory, and the sanitized git environment.
- `tests/fixtures/projects/production.ts` — the production-composition harness: host root, home, cwd, injected seams (spawn runner, transport, git child runner, daemon capability), `run(argv)`, project-root resolution, and host-root/project-root snapshots.
- `tests/fixtures/projects/host-index.ts` — index seeding/reading helpers for the corrupt, pruned, mistrusted-location, and 200-entry cells, plus the counting index seam.
- Fixture files are never named `*.test.ts`.

**Reused fixtures.** `tests/fixtures/state/harness.ts` (`makeTempRoot`, `makeIdentity`, `openStore`, `listStoreFiles`, `ledgerDigest`, `digestPaths`, `keyArtifactMode`, `seedAuditPairs`, `quarantine*`), `tests/fixtures/queue/production/harness.ts` (production-composition shape and `makeNonCheckoutDirectory`), `tests/fixtures/watchdog/temp-git.ts` (guard and real-git discipline), `tests/fixtures/pilot/repo.ts` (sanitized git environment), `tests/fixtures/mcp/**` (MCP composition), `tests/fixtures/help-guide/coverage.json` (inventory), `tests/golden/helpers` (`bufferSink`, `SYNTHETIC_BRAND`).

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Implementation status | Evidence class | Execution command |
|-------|-----------|-----------------------|----------------|-------------------|
| TC-PROJ-001 | `tests/behaviour/projects-scope-isolation.test.ts` | To Implement | Suite + revert (P1) | `bun test tests/behaviour/projects-scope-isolation.test.ts` |
| TC-PROJ-002 | same | To Implement | Suite | same |
| TC-PROJ-003 | `tests/behaviour/projects-identity.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-identity.test.ts` |
| TC-PROJ-004 | same | To Implement | Suite | same |
| TC-PROJ-005 | same | To Implement | Suite (`AC-F1-5`'s owning test, spec Appendix D) | same |
| TC-PROJ-006 | `tests/behaviour/projects-host-index.test.ts` | To Implement | Suite + mutation (P2) | `bun test tests/behaviour/projects-host-index.test.ts` |
| TC-PROJ-007 | same | To Implement | Suite | same |
| TC-PROJ-008 | same | To Implement | Suite | same |
| TC-PROJ-009 | same | To Implement | Suite + mutation (P3) | same |
| TC-PROJ-010 | same | To Implement | Suite + mutation (P4) | same |
| TC-PROJ-011 | `tests/behaviour/projects-list-contract.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-list-contract.test.ts` |
| TC-PROJ-012 | same | To Implement | Suite | same |
| TC-PROJ-013 | same | To Implement | Suite (DEC-16 naming) | same |
| TC-PROJ-014 | `tests/behaviour/projects-handover.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-handover.test.ts` |
| TC-PROJ-015 | same | To Implement | Suite + mutation (P5) | same |
| TC-PROJ-016 | same | To Implement | Mutation (P5) + Suite | same |
| TC-PROJ-017 | `tests/behaviour/projects-daemon-reachability.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-daemon-reachability.test.ts` |
| TC-PROJ-018 | same | To Implement | Suite | same |
| TC-PROJ-019 | same | To Implement | Suite | same |
| TC-PROJ-020 | `tests/structure/projects-state-scope-policy.test.ts` | To Implement | Suite (structural; three sites + override precedence in one place) | `bun test tests/structure/projects-state-scope-policy.test.ts` |
| TC-PROJ-021 | `tests/behaviour/projects-state-placement.test.ts` | To Implement | Suite + revert (P1); runtime half of AC-F6-1's override clause | `bun test tests/behaviour/projects-state-placement.test.ts` |
| TC-PROJ-022 | `tests/behaviour/projects-scope-mcp.test.ts` | To Implement | Suite; MCP half of AC-F6-1's override clause | `bun test tests/behaviour/projects-scope-mcp.test.ts` |
| TC-PROJ-023 | `tests/behaviour/projects-daemon-socket.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-daemon-socket.test.ts` |
| TC-PROJ-024 | `tests/structure/dispatch-bash-authority.test.ts` (extend) | Existing – Update | Suite + mutation (P6) | `bun test tests/structure/dispatch-bash-authority.test.ts` |
| TC-PROJ-025 | `tests/behaviour/projects-owner-hold.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-owner-hold.test.ts` |
| TC-PROJ-026 | `tests/behaviour/projects-migration.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-migration.test.ts` |
| TC-PROJ-027 | same | To Implement | Suite + mutation (P7) | same |
| TC-PROJ-028 | `bash scripts/.tests/test-doc-distribution.sh` (suite half: distribution marker and registry presence) | Existing – No Change (note added) | Review-verified + Suite | `bash scripts/.tests/test-doc-distribution.sh` |
| TC-PROJ-029 | `tests/behaviour/projects-help.test.ts` | To Implement | Suite | `pnpm build && bun test tests/behaviour/projects-help.test.ts` |
| TC-PROJ-030 | `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` | Existing – No Change (inventory + page map updated) | Suite + Review-verified | `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` and `pnpm check:help` |
| TC-PROJ-031 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` | Existing – No Change | Suite + Review-verified | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` |
| TC-PROJ-032 | `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-literals.test.ts` | Existing – No Change (registry updated) | Suite | `bun run scripts/checks/forbidden-literals.ts && bun run scripts/checks/privacy-literals.ts` |
| TC-PROJ-033 | none (manual) | Manual Only | Review-verified | — (review verdict + §10) |
| TC-PROJ-034 | none (manual) | Manual Only | Review-verified | — (review verdict + §10) |
| TC-PROJ-035 | `tests/checks/privacy-release.test.ts` | Existing – No Change | Suite | `bun test tests/checks/privacy-release.test.ts` |
| TC-PROJ-036 | existing state/audit/retro/inventory suites | Existing – No Change | Suite + Review-verified | `bun test tests/structure/state-contract.test.ts tests/structure/state-imports.test.ts tests/structure/content-inventory.test.ts tests/behaviour/audit-chain.test.ts tests/behaviour/retro-chain.test.ts tests/behaviour/retro-key-artifact.test.ts` (and the rest of the family) |
| TC-PROJ-037 | `tests/behaviour/projects-performance.test.ts` + structural half in `projects-state-scope-policy.test.ts` | To Implement | Suite | `bun test tests/behaviour/projects-performance.test.ts` |
| TC-PROJ-038 | `tests/checks/projects-test-isolation.test.ts` | To Implement | Suite | `bun test tests/checks/projects-test-isolation.test.ts` |
| TC-PROJ-039 | none (manual) | Manual Only | Review-verified | the seven procedures in TC-PROJ-039, each followed by the affected file's `bun test` |

**Phase grouping for `@plan-writer`** (so the delivery plan can cite TCs per phase):

| Phase (spec §18 order) | TCs |
|---|---|
| 1 — state-scope policy and identity marker | TC-PROJ-003, 004, 005, 020, 038 |
| 2 — host index | TC-PROJ-006, 007, 008, 009, 010, 037 (structural half may land later) |
| 3 — `projects` command and projections | TC-PROJ-001, 002, 011, 012, 013, 014, 015, 016, 017, 018, 019 |
| 4 — policy consumption on every surface | TC-PROJ-021, 022, 023, 024, 025 |
| 5 — migration and legacy detection | TC-PROJ-026, 027, 028 |
| 6 — mount, help, errors, literals | TC-PROJ-029, 030, 031, 032 |
| 7 — reconciliation and release | TC-PROJ-033, 034, 035, 036 |
| Review gate (after phase 7, before DoD) | TC-PROJ-039 |

Phase 3 lists TC-PROJ-001/002 even though isolation is phase 1's property, because the tests can only be written once the command that reports project roots exists; the *code* that satisfies them lands in phase 1. The delivery plan should say which; this plan does not reorder the spec's delivery order.

**Supporting changes (not test cases):**

- `tests/fixtures/projects/state-scope.ts`, `temp-repos.ts`, `production.ts`, `host-index.ts` — new fixtures (§6).
- `tests/fixtures/help-guide/coverage.json` — `projects` in `commands`, its M2 page in `referencePages`.
- `scripts/checks/help-guide-coverage.ts` and `tests/checks/reference-page-parity.test.ts` — the per-command reference page root (DEC-13).
- `scripts/checks/forbidden-literals.registry.json` — the migration note in the user-facing-docs scope.
- `packages/cli/src/help/prompt-required-commands.ts` and `packages/cli/src/help.ts` — `projects` in the set and its help entries.
- `packages/core/src/contracts/error-table.ts` — one domain kind, three rows, matching `doc/spec/features/feature-result-contract.md`.

**Mocking requirements per TC:** only declared seams — `homeDirectory`, the environment record, `cwd`, the harness spawn runner and starter, the GitHub transport, the git child runner, the daemon capability, the clock, and the run-id factory. No `bun:test` `mock.module`, no monkey-patching of adapters, no module-load-time stubbing.

**Gate battery mapping** (the quality bar is `TMPDIR=$PWD/tmp/tmpdir pnpm check`):

| Gate | Command | Owning TCs | Notes |
|---|---|---|---|
| Build (prerequisite) | `pnpm build` | all subprocess cells (TC-PROJ-029) | Required because the bin imports package subpaths that resolve to `dist`; `pnpm test`/`pnpm check` run it via `pretest`/`pretypecheck`, but a direct `bun test` does not. |
| Aggregate | `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check` | all | lint → format:check → typecheck → test → check:boundaries → prompt-conformance → help-coverage → exports-parity |
| Help coverage | `pnpm check:help` | TC-PROJ-030 | |
| Reference-page parity | `bun test tests/checks/reference-page-parity.test.ts` | TC-PROJ-030 | |
| Error-table sync | `bun test tests/checks/error-table-sync.test.ts` | TC-PROJ-031 | bidirectional |
| Literal scans | `bun run scripts/checks/forbidden-literals.ts`, `bun run scripts/checks/privacy-literals.ts` | TC-PROJ-032 | |
| Release shape | `bun test tests/checks/privacy-release.test.ts`, `bun run scripts/checks/changesets-group.ts` | TC-PROJ-035 | |
| Doc distribution | `bash scripts/.tests/test-doc-distribution.sh` | TC-PROJ-028 | blocks merge on drift |
| Boundaries | `pnpm check:boundaries` | TC-PROJ-020, TC-PROJ-036 | the new policy module must not introduce a forbidden edge |
| Whitespace | `git diff --check` | all | |

**Focused verification while iterating** (after one `pnpm build`):

```
bun test tests/behaviour/projects-scope-isolation.test.ts
bun test tests/behaviour/projects-identity.test.ts
bun test tests/behaviour/projects-host-index.test.ts
bun test tests/behaviour/projects-list-contract.test.ts
bun test tests/behaviour/projects-handover.test.ts
bun test tests/behaviour/projects-daemon-reachability.test.ts
bun test tests/structure/projects-state-scope-policy.test.ts
bun test tests/behaviour/projects-state-placement.test.ts tests/behaviour/projects-scope-mcp.test.ts
bun test tests/behaviour/projects-daemon-socket.test.ts tests/structure/dispatch-bash-authority.test.ts
bun test tests/behaviour/projects-owner-hold.test.ts tests/behaviour/projects-migration.test.ts
bun test tests/behaviour/projects-help.test.ts
bun test tests/behaviour/projects-performance.test.ts tests/checks/projects-test-isolation.test.ts
bun test tests/checks tests/structure tests/behaviour/queue-production-binding.test.ts
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| TR-1 | False green: a suite injects project roots or keys and never exercises the real derivation. | The production harness accepts only `homeDirectory`, the environment record, and `cwd`; it exposes no way to pass a project root or a key. Expected roots are the unique temp paths the fixture created. TC-PROJ-038's meta-scan forbids a fixture that short-circuits the derivation. |
| TR-2 | `git` is absent or too old in some environment, so the identity suites fail for an environmental reason. | The suites fail loudly with the failing `git` command and its stderr; `git` is already required by `tests/fixtures/watchdog` and `tests/fixtures/pilot`, so this is a repository-wide condition, not a new dependency. No suite skips silently. |
| TR-3 | `TMPDIR` inside the repository makes `tmpdir()` a git work tree, so the `unbound` cell silently resolves a project. | The non-checkout helper pre-asserts `findGitRoot === undefined` and falls back to the repository's parent; it throws with an explanatory message instead of producing a false pass. |
| TR-4 | Permission-based "unreadable" cells pass as root in a container. | Structural provocation (a regular file where a directory is expected) is the primary mechanism; `chmod` cells are gated on `process.getuid?.() !== 0`. |
| TR-5 | The 200-project latency cell measures the fixture rather than the product. | The cell asserts the reported revision and row count equal the seeded index, and the per-invocation read/write counts are asserted separately; the 25-project cell uses real stores. |
| TR-6 | Structural assertions rot (renames, added files, legitimate second consumers). | AST-based, allowlist-driven, message-naming assertions; each allowlist addition is a deliberate review event; the seeded negative controls prove the scans are live. |
| TR-7 | A review-verified criterion is quietly treated as suite-covered. | §3.1 marks the evidence class per AC and §10 records each review item with its quoted evidence; the DoD gate reads §3.1, not the prose. |
| TR-8 | Migration bytes differ only because of a re-encode that every read survives. | The byte digest is per file across the whole artifact set, including header, index, chain keys, retro sidecar and lock, and quarantine; modes are compared too. |
| TR-9 | The `projects list` latency measurement is flaky on a loaded CI machine. | p95 over 10 samples after a warm-up, with the thresholds taken from the spec and the measured values recorded; a threshold breach is investigated, not retried silently. |
| TR-10 | An override-honouring cell passes vacuously because the fixture's home equals the host root, so a store that ignores `<PREFIX>_STATE_DIR` still resolves into the host root. | The fixture factory always produces a home distinct from the host root (neither an ancestor of the other), asserted by TC-PROJ-038 step 7; TC-PROJ-021/022 additionally assert the home-default path was never created. |
| TR-11 | A structural single-site assertion is satisfied by moving the inline composition into a shared helper that still ignores the override. | TC-PROJ-020 step 5 requires the override read and its precedence to exist in exactly one place (the policy), and step 6 asserts the policy's own override branch; the behavioural cells in TC-PROJ-021/022 fail if the helper ignores the override. |

### 8.2 Assumptions

- `resolveCheckoutGitDirectories` returns the git directory and the common directory from the working directory and never ascends above the first `.git` (verified in `packages/adapters/src/repo/index.ts`; spec §12).
- The git common directory is shared by all linked worktrees of one repository and by no second repository; a file stored beside it survives a rename (the delivered dispatch-identity discipline).
- The store facade accepts an injected state directory per open and creates missing parents, so a deeper root needs no state-layer change.
- The host root is the delivered override-aware rule: an absolute environment override wins, otherwise the injected home plus the brand state directory name (spec v1.1 §2.1, §12, §8.5). There are **three** derivation sites today and only the runtime-aware edge honours the override: `packages/cli/src/production.ts` composes `${homeDirectory}/${brand.stateDirectoryName}` inline, `packages/mcp/src/serve.ts` repeats that inline composition, and `packages/cli/src/edge.ts` (`stateDirectoryFor`) applies `resolveStateDirectoryScope`. After the change all three consume the one policy, so the tests must supply a home **distinct** from the host root (otherwise an override-blind store would pass) and must assert the home-default path was never created.
- The runtime-aware edge keeps composing the command audit store through the same policy, so after the change the audit ledger lands under the project root rather than at the host root; the existing audit suites keep their injected seams and stay green unmodified.
- `PROMPT_REQUIRED_COMMANDS` is the single authority for the composed set; the coverage inventory mirrors it (the parity suite asserts set equality).
- The `projects` family is not yet composed, so every new suite is a new file and no existing golden changes.
- The MCP surface can consume the policy without importing the CLI (it already imports `core` and `adapters`).
- Handover records are readable by key prefix and the derived authority document is a plain file, so the projection needs no new record.
- Tests may create real temporary repositories and may spawn `git` (spec §12).
- `origin/main-tools` exists in the test work tree for the release suite; the release suite already anchors on the merge base and tolerates a growing changeset population.

### 8.3 Findings: closed by spec v1.1 and remaining acknowledged items

All findings raised by test plan v1 have been dispositioned. Three are **closed** by the spec revision (each is listed with its closure evidence, so it cannot be re-raised at `dor_check`); three remain as **recorded, resolved-by-acknowledgement** items that need no further action.

**Closed by spec v1.1:**

| ID | Was | Closed by | Verified in this plan |
|----|-----|-----------|----------------------|
| G-1 | The declared host-scoped `unbound` scope had no acceptance criterion; `TC-PROJ-005` was AC-less. | Spec v1.1 R1 added **`AC-F1-5`** (declared `unbound` root, one bounded warning, no registration, no project root, unchanged exit code, no path-derived key) and recorded its Appendix D evidence row naming `TC-PROJ-005`. | `TC-PROJ-005` is now `AC-F1-5`'s owning test; §3.1 has the AC row with no AC-less marker; §1.2, §5.1, §7 and §10 no longer describe a gap. |
| PG-2 | The subject of a `projects.identity-unreadable` refusal was unspecified for a host-overview read; the plan carried an `IDENTITY_REFUSAL_SUBJECT` placeholder constant. | Spec v1.1 R2 specified the naming rule in `AC-F3-3` and recorded it as **`DEC-16`**: the offending checkout root in the runtime summary, plus the project key and identifier when the marker is readable but identity still does not resolve; `projects.state-unavailable` names the project key and its state location; no other project's root in the envelope, warnings, or text. | `TC-PROJ-013` asserts the specified naming in three cells and adds the "no other project's root disclosed" negative; the placeholder constant is gone. |
| OQ-T4 | The plan's source probe found that the production store ignored `<PREFIX>_STATE_DIR` while the runtime-aware edge honoured it, and that `AC-F6-1` claimed a single site. | Spec v1.1 R3 corrected §2.1, §2.2, G-6, the §4.1 KPI table, F-1, F-6, the §12 assumption, the §8.5 compatibility list, §16, §16.1, §19 and **strengthened `AC-F6-1`**: three derivation sites today, only the edge override-aware, and every site must honour the override after the change. | `TC-PROJ-020` pins all three sites, the seven-consumer allowlist, and single-place override precedence; `TC-PROJ-021`/`TC-PROJ-022` prove override honouring behaviourally with a home distinct from the host root; `TC-PROJ-028` requires the note to state the override relocation. |

> Naming note: the finding id **G-1** in this finding table is a *test-plan finding* id and is unrelated to spec goal **G-1** ("Scope delivery state per repository"), which is referenced in several TCs' `Related IDs` rows. The two never refer to the same thing.

**Recorded, resolved by acknowledgement (no action required):**

| ID | Item | Disposition | Test obligation |
|----|------|-------------|-----------------|
| R-1 | Which checkout `root` a linked worktree reports: the invoking worktree's path, or the clone's main checkout path. `AC-F1-3` requires the key and state location to be identical and only "the reported checkout root" to change after a rename; both readings satisfy that. | Acknowledged as an implementation detail the ACs deliberately leave open. Test default: the **invoking worktree's absolute path** (the same rule as a nested directory). If delivery reports the main checkout instead, only that one assertion changes; key and state-location equality are unaffected. Recorded in §10. | TC-PROJ-003 cell 3. |
| OQ-T2 | **Coverage allocation, not a spec gap.** Spec F-3 requires `projects list` to be read-only ("never prunes, never migrates, never creates a project root"), but no AC asserts that clause in isolation; the nearest are `AC-F3-2` (stability) and `AC-F2-3` (corrupt read changes no file). | Acknowledged and carried inside existing TCs rather than promoted to a new AC: `TC-PROJ-012` (index bytes, revision, mtime and host-root listing unchanged across two runs) and `TC-PROJ-008` step 2. No new TC and no new AC claimed. | TC-PROJ-012, TC-PROJ-008. |
| OQ-T3 | **Evidence-class split.** `AC-F9-2` names `Suite` but includes "the M1 milestone snapshot pages are unmodified"; `AC-F9-3` names `Suite` but includes "no existing row … reworded"; `AC-F10-3` names `Suite` but includes "every pre-existing changeset is byte-identical" — diff-against-a-moving-base claims, which `.ai/rules/testing-strategy.md` forbids in permanent suites. | Acknowledged and split per criterion: the **tree-invariant** half is a suite (gates green, membership/set equality, page content, row count and code set, changeset shape via the existing merge-base-anchored release suite), and the **diff** half is review-verified and recorded in §10. Nothing is dropped; the class is stated honestly in §3.1. | TC-PROJ-030 (step 6), TC-PROJ-031 (step 6), TC-PROJ-035 (rides the existing merge-base-anchored suite). |
| OQ-T5 | **Sequencing.** This plan was written before the implementation plan, so no TC cites a plan phase id. | Acknowledged: §7 maps TCs to the spec's §18 phase order so `@plan-writer` can cite them; TC ids are stable and grouped by subject, not by phase. | §7 phase grouping table. |

No item above blocks delivery and no item requires a PM ruling. G-1, PG-2 and OQ-T4 are closed by the spec's own text; R-1, OQ-T2, OQ-T3 and OQ-T5 are acknowledged implementation or evidence-allocation choices.

No acceptance criterion is unmapped, and no test case is orphaned: every one of the 35 criteria has at least one owning TC, and every TC names at least one AC (or, for the cross-cutting NFR TCs 036–039, names the NFR it proves and the ACs whose evidence class it serves).

### 8.4 Test-maintenance notes

- The single-site structural assertion (TC-PROJ-020) will red when a future surface legitimately needs a new state path; that is intended friction, and the fix is to consume the policy, not to extend the allowlist. It will also red if override precedence is re-implemented anywhere, even correctly, because a second precedence site is the same defect as a second derivation site.
- The handover matrix is written as a table-driven test over seeded inputs; adding a row means adding a table row plus one expected token, not a new test.
- The migration snapshot helper is reusable: a future change that touches the store layout can re-use the byte/mode snapshot without re-deriving the artifact set.
- Anything that changes the host-root contents (a new host-level document) reds TC-PROJ-001, 021 and 026, which all assert the declared host-root set. That is deliberate: the host root's contents are part of the contract (DM-3).

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1 | 2026-11-11 | @test-plan-writer | Initial test plan for GH-288 from spec v1.0: 39 test cases covering all 34 acceptance criteria, the seven non-functional requirements with thresholds, and the delivered gate battery; new fixtures under `tests/fixtures/projects/**`; the seven-procedure revert/mutation bundle; and five declared items (gap G-1, provocation PG-2, worktree-root resolution R-1, evidence-class split OQ-T3, production-override premise finding OQ-T4). |
| 2 | 2026-11-11 | @test-plan-writer | Re-aligned to spec **v1.1** after the `specification` phase was reopened on this plan's v1 findings. The revision changes exactly four things and no TC id moved. **(1) G-1 closed:** spec v1.1 added `AC-F1-5` (declared `unbound` root, one bounded warning, no project registration, no project root, unchanged exit code, no path-derived key); `TC-PROJ-005` is now its owning test — the AC-less marker is removed from §3.1/§5.1/§7/§10, the criterion appears in the coverage matrix with its Appendix D traceability, and the TC's assertions were rewritten one-to-one onto the criterion's clauses. **(2) PG-2 closed:** spec v1.1 specified the refusal naming rule as `DEC-16`; `TC-PROJ-013` was renamed "Exit-code matrix, DEC-16 refusal naming, and the three error identities", the `IDENTITY_REFUSAL_SUBJECT` placeholder constant was deleted, and the test now asserts the offending checkout root in the runtime summary, the project key plus identifier when the marker is readable but identity does not resolve, the project key and state location on `projects.state-unavailable`, and a new negative that no other project's root appears in the envelope, warnings, or text. **(3) OQ-T4 closed and `AC-F6-1` strengthened:** spec v1.1 recorded the three derivation sites (production store and MCP store inline and override-blind; only the runtime-aware edge override-aware) — `TC-PROJ-020` now pins all three sites, a seven-consumer allowlist (adding the edge audit store), single-place override precedence plus a policy-branch assertion, and a duplicated-override-read negative control; `TC-PROJ-021` and `TC-PROJ-022` gained the behavioural override half with a home **distinct** from the host root and a home-default negative; `TC-PROJ-038` gained a home-distinctness meta-assertion; `TC-PROJ-028` now requires the migration note to state the override relocation. **(4) Findings closed and recorded:** §8.3 was restructured into "closed by spec v1.1" (G-1 → AC-F1-5, PG-2 → DEC-16, OQ-T4 → §2.1/§8.5/AC-F6-1) and "resolved by acknowledgement" (R-1 worktree root choice, OQ-T2 read-only carried inside existing TCs, OQ-T3 evidence-class split, OQ-T5 sequencing), so none can be re-raised at DoR; two new testing risks (TR-10 vacuous-override cell, TR-11 helper-that-ignores-the-override) were added. Traceability re-verified set-equal to the spec's 35 ACs; TC ids unchanged at 39 and no TC added or removed. |

## 10. Test Execution Log

Populated during delivery, review, and the quality-gate phase. Record per file: the command, the date, the result summary (pass/fail counts), and the informational wall clock. Never record an aggregate "green" in place of the per-gate rows below.

**Gate rows** (one per gate; record the exact command and the exit status):

| Gate | Command | Date | Result | Notes |
|------|---------|------|--------|-------|
| Build | `pnpm build` | | | prerequisite for subprocess help cells |
| Aggregate | `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check` | | | includes lint, format, typecheck, test, boundaries, prompt-conformance, help-coverage, exports-parity |
| Help coverage | `pnpm check:help` | | | |
| Reference-page parity | `bun test tests/checks/reference-page-parity.test.ts` | | | |
| Error-table sync | `bun test tests/checks/error-table-sync.test.ts` | | | |
| Literal scans | `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/privacy-literals.ts` | | | |
| Release shape | `bun test tests/checks/privacy-release.test.ts`; `bun run scripts/checks/changesets-group.ts` | | | |
| Doc distribution | `bash scripts/.tests/test-doc-distribution.sh` | | | |
| Boundaries | `pnpm check:boundaries` | | | |
| Whitespace | `git diff --check` | | | |

**Per-test-case rows:**

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-PROJ-001 | | | |
| TC-PROJ-002 | | | |
| TC-PROJ-003 | | | record the linked-worktree `root` value and confirm resolution R-1 |
| TC-PROJ-004 | | | |
| TC-PROJ-005 | | | `AC-F1-5` owning test; record the one-warning count and the index-unchanged snapshot |
| TC-PROJ-006 | | | |
| TC-PROJ-007 | | | |
| TC-PROJ-008 | | | |
| TC-PROJ-009 | | | |
| TC-PROJ-010 | | | |
| TC-PROJ-011 | | | |
| TC-PROJ-012 | | | |
| TC-PROJ-013 | | | record the three DEC-16 naming cells and the "no other project's root" scan |
| TC-PROJ-014 | | | |
| TC-PROJ-015 | | | |
| TC-PROJ-016 | | | |
| TC-PROJ-017 | | | |
| TC-PROJ-018 | | | |
| TC-PROJ-019 | | | record the measured probe time and the declared timeout |
| TC-PROJ-020 | | | |
| TC-PROJ-021 | | | |
| TC-PROJ-022 | | | |
| TC-PROJ-023 | | | |
| TC-PROJ-024 | | | |
| TC-PROJ-025 | | | |
| TC-PROJ-026 | | | record the artifact count, the mode set, and the audit/retro verdicts |
| TC-PROJ-027 | | | |
| TC-PROJ-028 | | | review item: quote the five required statements |
| TC-PROJ-029 | | | |
| TC-PROJ-030 | | | review item: M1 page diff (expect zero) |
| TC-PROJ-031 | | | review item: error-table/spec diff (new kind only) |
| TC-PROJ-032 | | | review item: registry diff (one addition, no scope change) |
| TC-PROJ-033 | | | review item: one quoted sentence per system-spec page |
| TC-PROJ-034 | | | review item: one quoted line per corpus file |
| TC-PROJ-035 | | | |
| TC-PROJ-036 | | | review item: `tests/**` diff (expect zero edits in state/audit/retro suites) |
| TC-PROJ-037 | | | record p95 at 25 and 200 projects, maintenance p95, index read/write counts |
| TC-PROJ-038 | | | |
| TC-PROJ-039 | | | record P1–P7 separately: artifact path, red set, green set, restored green run — never one combined row |
