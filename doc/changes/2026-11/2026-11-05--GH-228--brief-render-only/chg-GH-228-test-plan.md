---
id: chg-GH-228-test-plan
status: Proposed
version: 1.2
created: 2026-11-05T00:00:00Z
last_updated: 2026-11-06T12:00:00Z
owners: [engineering]
service: delivery-os
labels: [change, m1]
version_impact: minor
summary: "Verify M1-S6 brief render-only v0: one deterministic read-only command that projects the same injected collector facts as the status digest into a decision-first, one-screen owner brief. The battery proves shared-truth agreement (every brief claim equals the digest's claim for identical facts, zero brief-only facts, zero brief-only reads), anchored-action honesty (ready-to-merge only from observed approved non-draft open pull-request evidence and never a gate verdict; owner-gate ages only from parseable provider-native timestamps with unknown otherwise and no SLA state), a closed three-entry placeholder catalog that can never render as observed, empty, or zero, exact per-surface state agreement with the digest's state-derivation matrix including the full failed/absent-read negative-control matrix, the shipped contract posture (exit 0 with named surfaces on collector unavailability, only fallback.invocation/internal failing, zero new error-table rows, error-table sync green), byte-identical determinism, the 24-line/4096-byte human and 65536-byte machine bounds with explicit truncation, no LLM or network capability in the render path asserted by structure and boundary checks, and the redaction/read-only/zero-spawn/credential-reference posture. All fixtures are committed and injected; the battery performs zero live network calls, reads no real credential, and never rewrites its goldens."
links:
  change_spec: ./chg-GH-228-spec.md
  implementation_plan: ./chg-GH-228-plan.md   # authored in delivery_planning (v1.0)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S6: Brief render-only v0

## 1. Scope and Objectives

`brief` is the owner's one-screen starting point and the first surface whose entire value is *not lying*. The tests must prove five things at once: **shared truth** (the brief is a pure projection of the same injected collector facts the status digest consumes — every claim it makes equals the digest's claim, it invents no fact, and it performs no read of its own), **anchor honesty** (ready-to-merge cites observed approved non-draft open pull-request evidence and is never a gate verdict; owner-gate ages derive only from a present, parseable provider-native timestamp and are unknown otherwise; no `slaState` is ever fabricated), **never-silent gaps** (the closed three-entry placeholder catalog renders by name with owning story and `not-delivered` state, and no unbuilt capability, failed read, absent source, or unresolved commit can render as observed, clear, green, available, or zero), **contract posture** (exactly one `CommandResult` envelope, exit `0` even when collection fails, only the existing containment identities can fail, zero new error-table rows or domain kinds, and the sync check stays green), and **render discipline** (byte-identical determinism, a 24-line/4096-byte human screen, a 65536-byte machine payload, explicit truncation, no timestamps, no raw payloads, no generated prose, no model call, no network capability, no child process, and zero writes).

This plan is a design and verification map, not an execution claim: no build, test, or command was run against a delivered state by this writer.

### 1.1 In Scope

- The `brief` command surface: exactly one command name, zero positionals, zero command-specific flags beyond the global machine-output switch `--json`, rejection before any source read (F-1, AC-F5-1, AC-F1-1).
- The `delivery.brief.v1` payload contract: schema version, injected generation time, repository binding reference, per-surface states, ranked anchored actions, placeholder entries, explicit truncation markers; vocabulary consumed by reference from the status contracts (DM-1..DM-4, AC-F1-1, NFR-1).
- Shared-truth agreement on identical injected facts: per-surface states, counts, ages, action identities, placeholder justifications; zero brief-only facts; zero brief-specific reads (F-1, F-4, AC-F1-1, NFR-3).
- The ready-to-merge anchor: observed approved, non-draft, open pull-request evidence only; no claim under unknown or unavailable review signals; attention, never a gate verdict (F-2, DM-2, AC-F2-1, DEC-7).
- The owner-gate age anchor: parseable provider-native last-modified timestamp only; unknown otherwise; no SLA classification; the `gate-sla-states` placeholder in its place (F-2, F-3, F-4, AC-F2-2).
- The closed three-entry placeholder catalog and its render discipline (F-3, DM-3, AC-F3-1, DEC-6).
- The complete digest state-derivation matrix as brief surfaces, including every failed, absent, unattempted, and unresolved read control (F-4, DM-4, AC-F4-1).
- Envelope, exit projection `{0,1,2}`, collector unavailability as digest data at exit `0`, containment identities only, zero new error rows/domain kinds/configuration keys, sync green (F-5, NFR-7, AC-F5-1, DEC-2).
- Byte-identical determinism and content discipline (no timestamps, no raw payloads, no generated prose) (F-6, NFR-2, AC-F6-1).
- No-LLM render path asserted by import/boundary structure checks plus review (F-6, NFR-5, AC-F6-2).
- The redaction chokepoint, zero-write/zero-mutation/zero-child-process posture, and the credential-reference-only composition guard (F-6, NFR-6, AC-F6-3).
- One-screen and machine bounds with explicit truncation, and the pure-projection latency bound (NFR-1, NFR-4, AC-F1-2).

### 1.2 Out of Scope & Known Gaps

- [OUT] Gate verdicts, merge authorization, verify-gates behaviour, and the merge transaction (NG-1); the ready-to-merge anchor is asserted as an evidence-citing attention projection only.
- [OUT] New collectors, adapter reads, configuration keys, state-schema changes, packages, subpaths, or runtime-API locations (NG-2); the battery asserts their absence.
- [OUT] SLA escalation mechanics and any `escalated`/expiry state (M1-S5); only ages and the placeholder are tested.
- [OUT] Typed blocker questions or any question record (M1-S16); only the named placeholder is tested.
- [OUT] Queue/lane engine data (M1-S17); only the `not-delivered` placeholder is tested.
- [OUT] Spend or cost surfaces (M1-S19, DEC-5); the battery asserts spend is *absent* from v0 rather than rendered.
- [OUT] Any change to the status digest schema, sections, order, or command (NG-4); the existing status suites run unchanged as the regression half.
- [OUT] Live-network, credentialed, or opt-in live-smoke variants; the brief battery is hermetic by construction.
- [GAP-T1 — resolved in spec v1.1] Owner-gate ages have no digest-side claim to compare against: the shipped digest exposes `ageDays` only on stall items and parked-work items, and owner-hand-back items carry no age or timestamp. AC-F1-1 v1.1 is two-branch (strict equality where the digest makes a claim; otherwise the digest's declared derivation rule over the same facts), and spec F-2 names the parse-and-floor rule as the source. §4.2 and §4.5 implement exactly that oracle; nothing further is owed.
- [GAP-T2 — resolved in spec v1.1] The render-surface set is now pinned by DM-5: exactly nine ids, six digest-section surfaces plus the three DEC-6 placeholder surfaces, with ready-to-merge and owner-gate ages as anchored-action groups rather than surfaces. §4.6 restates DM-5 as TC-BRIEF-001's cited authority.
- [GAP-T3 — resolved in spec v1.1] "Named placeholders" on collector unavailability is now disambiguated: spec F-5/DEC-2 say the affected *surface* names its own evidence state (state word plus reason), distinct from the closed DEC-6 catalog, which stays at exactly three entries. §4.3 and §4.8 already bind that reading.
- [GAP-T4 — delivery-bound spellings] Export names, internal helper names, fixture/golden file names, surface ids, and human-line grammar (OQ-1) are delivery-bound. Semantics, states, identities, bounds, exits, and AC mapping are pinned here and may not be rebound.
- [GAP-T5 — no dedicated AC for NFR-3, NFR-4, NFR-8] The read-cost, latency, and brand-neutrality NFRs have no AC of their own; §3.3 maps them to the AC they qualify (AC-F1-1) plus the existing literal/inventory gates, so nothing is tested without an anchor.

## 2. References

- **Change specification**: [chg-GH-228-spec.md](./chg-GH-228-spec.md) — F-1..F-6, AC-F1-1..AC-F6-3 (10), DM-1..DM-4, NFR-1..NFR-8, DEC-1..DEC-7, RSK-1..RSK-6, OQ-1, §6 flows 1–3, §7 scope, §8 interfaces, §16 affected components.
- **PM record**: [chg-GH-228-pm-notes.yaml](./chg-GH-228-pm-notes.yaml) — M0-S6 confirmed shipped; the proposed brief contract's exit-2 row and `status.collector.<id>.unavailable` identity flagged for reconciliation (resolved by DEC-2); M1-S5 ranks after the brief, so SLA states are placeholders.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` and `tests/{structure,behaviour,golden,checks,boundaries}`; fixtures under `tests/fixtures/**` are never `*.test.ts`; permanent suites assert the current tree; goldens are regenerated only by an explicit command; `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, injected time/randomness/environment, the error contract, fake-based deterministic tests, no moving-base diff assertions.
- **Status digest current truth**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — the six sections and fixed order, the closed five-value state set, the normative state-derivation matrix, the tracker owner-hand-back family, the changes review-signal availability model, CI classification, the always-`not-delivered` lanes section, the declared bounds, the credential-reference-only composition guard, and the human grammar this brief must not contradict.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, `{0,1,2}` projection, containment identities, the sole redaction chokepoint, bidirectional error-table sync.
- **Queue ready** (observed-approval convention): [feature-queue-ready.md](../../../spec/features/feature-queue-ready.md) — `merge-ready` requires an observed `approved` review state on a non-draft open pull request; unknown review signal is `review-pending`, never ready.
- **Command registry and pack**: `doc/planning/oss-tooling/cli-command-registry.md` (`ados brief`, M1-S6, depends on M0-S6); `doc/planning/oss-tooling/milestones/m1/commands/brief.md` (proposed contract; its exit-2 row and error identity are illustrative and reconciled by DEC-2), `.../commands/status.md`, `.../contracts.md`.
- **Existing mechanisms reused (never re-implemented)**: `tests/fixtures/status/harness.ts` (`baseFacts`, `statusRuntime`, `runStatusCli`, `capSizedFacts`, the failure builders, `sectionById`); `tests/golden/helpers.ts` (`SYNTHETIC_BRAND`, buffer sinks); `tests/fixtures/status/{corpus,golden,matrix}/**`; `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/behaviour/status-negative-controls.test.ts`; `tests/behaviour/status-readonly-determinism.test.ts` (`guardStore`); `tests/behaviour/providers/support.ts` (`createFixtureTransport`, throwing-fetch guard); `tests/structure/{status-contract,status-imports,content-inventory,error-table,subpaths,branding-seam}.test.ts`; `tests/checks/{error-table-sync,exit-code-literals,forbidden-literals,privacy-literals,secret-read-boundary,fixture-sanitization}.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,secret-read-boundary,forbidden-literals,privacy-literals,workspace-entrypoints,exit-code-literals}.ts`.
- **Precedent for shape**: [chg-GH-183-test-plan.md](../2026-11-01--GH-183--closeout-v1-branch-cleanup/chg-GH-183-test-plan.md).
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#228` — M1-S6: Brief render-only v0.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Plan phase | Status |
|----|--------------------------|----------|------------|--------|
| AC-F1-1 | On identical injected facts every brief truth claim (per-surface states, counts, ages, action identities, placeholder justifications) equals the digest's corresponding claim, and the brief performs zero collector reads of its own | TC-BRIEF-002, TC-BRIEF-004, TC-BRIEF-005, TC-BRIEF-020 | Phase 2, Phase 3 | Covered |
| AC-F1-2 | Any fact set renders exactly one screen within the declared bounds (≤24 human lines and 4096 bytes; machine `data` ≤65536 bytes) with explicit truncation markers on any drop | TC-BRIEF-006, TC-BRIEF-014, TC-BRIEF-015 | Phase 2, Phase 4 | Covered |
| AC-F2-1 | An observed approved, non-draft, open pull request yields a ready-to-merge action citing that item's bounded digest evidence; unknown or unavailable review signals yield no merge-ready claim and a named five-value state | TC-BRIEF-007 | Phase 2 | Covered |
| AC-F2-2 | Owner-hand-back age renders only from a parseable last-modified timestamp; the absent/unparseable case is unknown and never fabricated; no SLA escalation state renders and the `gate-sla-states` placeholder appears | TC-BRIEF-008 | Phase 2 | Covered |
| AC-F3-1 | All three catalog placeholders render, each naming capability, owning story, and collector evidence state; blocker questions, SLA states, and the lane/queue surface never render as observed, empty, or zero | TC-BRIEF-001, TC-BRIEF-009, TC-BRIEF-016 | Phase 1, Phase 2 | Covered |
| AC-F4-1 | Every surface carries exactly the digest's section state for every failure mode in the state-derivation matrix; no failed, absent, unattempted, or unresolved read renders as clear, green, available, or zero | TC-BRIEF-004, TC-BRIEF-010, TC-BRIEF-016 | Phase 2 | Covered |
| AC-F5-1 | Exactly one valid `CommandResult` envelope with an exit in `{0,1,2}`; collector unavailability yields a success envelope at exit `0`; only existing containment identities fail (invocation → 1, internal → 2); zero new error-table rows and the sync check stays green | TC-BRIEF-002, TC-BRIEF-011, TC-BRIEF-012, TC-BRIEF-013, TC-BRIEF-015, TC-BRIEF-022 | Phase 3, Phase 4, Phase 8 | Covered |
| AC-F6-1 | Identical inputs produce byte-identical human and machine output; the human text contains no timestamps, no raw payloads, and no generated prose | TC-BRIEF-014, TC-BRIEF-015, TC-BRIEF-016, TC-BRIEF-017 | Phase 3, Phase 4 | Covered |
| AC-F6-2 | The brief render surface imports no model-call capability and performs no model call, asserted by dependency-boundary checks and review | TC-BRIEF-003, TC-BRIEF-021 | Phase 3, Phase 5 | Covered |
| AC-F6-3 | A planted secret never appears in output; the single redaction path covers envelope and human text; zero writes, zero state mutations, zero child processes; a non-credential-reference instance is refused exactly as status | TC-BRIEF-018, TC-BRIEF-019 | Phase 5 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 002, 004, 005, 006; F-2 → 007, 008; F-3 → 001, 009, 016; F-4 → 004, 008, 010, 016; F-5 → 002, 011, 012, 013, 015, 022; F-6 → 003, 014, 017, 018, 019, 020, 021.

**Decision coverage**: DEC-1 (same collector state) → 004, 005; DEC-2 (unavailability is digest data) → 011, 012, 022; DEC-3 (no LLM) → 003; DEC-4 (brief is the v0 owner-facing render surface) → 004, 009; DEC-5 (spend not in v0) → 001, 009; DEC-6 (closed three-entry catalog) → 001, 009, 016; DEC-7 (attention, not a verdict) → 007.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no inbound HTTP/REST endpoint (API-#), no event or message surface (EVT-#), and no external integration. The command surface and the data model are the interface.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| Command surface `brief [--json]` | TC-BRIEF-002 | Exactly one command name; zero positionals; `--json` adds no command behaviour; unknown flag or positional is `fallback.invocation` exit `1` with zero reads |
| DM-1 `delivery.brief.v1` payload | TC-BRIEF-001, TC-BRIEF-011, TC-BRIEF-015 | Schema version, injected generation time, repository binding reference, per-surface states, ranked actions, placeholder entries, truncation markers; no timestamps in human text; no parallel vocabulary |
| DM-2 Anchored action record | TC-BRIEF-001, TC-BRIEF-007, TC-BRIEF-008 | Item identity, citing evidence drawn from the digest's bounded item evidence, surface state; no verdict/authorization field |
| DM-3 Placeholder record | TC-BRIEF-001, TC-BRIEF-009, TC-BRIEF-016 | Stable capability id, owning story reference, collector evidence state (`not-delivered` for absent capability); closed at three |
| DM-4 Reused collector-state vocabulary | TC-BRIEF-001, TC-BRIEF-004, TC-BRIEF-010 | Five-value states, owner-hand-back family, review signals, CI classification, and declared bounds are imported by reference; zero redeclarations; single vocabulary home |
| Envelope and exit projection | TC-BRIEF-011, TC-BRIEF-012, TC-BRIEF-015 | One envelope per run; success envelope carries no `error`; `exitCode` ∈ `{0,1,2}`; `assertEnvelopeContract` empty |
| Existing status surfaces (regression half) | TC-BRIEF-004, TC-BRIEF-013, TC-BRIEF-021 | Unchanged status suites stay green; no status schema, order, or command change |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Human ≤24 lines and 4096 bytes; machine `data` ≤65536 bytes; every truncation explicit | TC-BRIEF-001, TC-BRIEF-006, TC-BRIEF-014, TC-BRIEF-015 | Covered |
| NFR-2 | Byte-identical human and machine output for identical inputs; no timestamps in human text; goldens pin the render | TC-BRIEF-014, TC-BRIEF-015, TC-BRIEF-017 | Covered |
| NFR-3 | Zero brief-specific reads: ≤3 outbound read-only requests, 1 park fold, 1 configuration resolve; zero retries, loops, pagination, or daemon interaction | TC-BRIEF-004, TC-BRIEF-005 | Covered |
| NFR-4 | Pure projection over cap-sized inputs completes within 50 ms on the reference environment | TC-BRIEF-020 | Covered |
| NFR-5 | Zero model calls in the render path, asserted by dependency-boundary checks and review | TC-BRIEF-003, TC-BRIEF-021 | Covered |
| NFR-6 | Zero writes, fences, state mutations, network writes, or child processes; only a credential-reference external-system instance admitted; one redaction path over all output | TC-BRIEF-003, TC-BRIEF-018, TC-BRIEF-019 | Covered |
| NFR-7 | Zero new error-table rows, domain kinds, and configuration keys; error-table sync green | TC-BRIEF-013 | Covered |
| NFR-8 | Zero product or binary literals in committed code and docs; injected brand binary name in human output; literal and inventory gates green | TC-BRIEF-001, TC-BRIEF-003 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 10 ACs (AC-F1-1 … AC-F6-3) appear in §3.1 with at least one TC.
- **Orphan TCs**: none. Each of the 22 TCs names at least one AC or NFR in §5.1 and §5.2.
- **Untestable ACs**: none. AC-F1-1's age branch is satisfiable under the §4.2/§4.5 derivation oracle (GAP-T1, resolved in spec v1.1); AC-F4-1's surface set is the §4.6 DM-5 nine-id set (GAP-T2, resolved); AC-F5-1's unavailability rendering is the §4.3/§4.8 reading that keeps the catalog closed (GAP-T3, resolved). Each resolution is recorded, not hidden.
- **Intentional duplicate coverage**: AC-F5-1 spans six TCs because envelope shape, exit `0` on unavailability, containment projection, error-table stability, golden bytes, and the documentation posture are six different oracles. AC-F6-1 spans three because byte equality, content discipline, and the golden pin fail independently. AC-F3-1 spans three because the catalog is asserted as contract data, as rendered lines, and as corpus completeness.
- **Regression half**: the existing `status-*` suites, `tests/structure/{error-table,result-contract,content-inventory,subpaths,branding-seam}.test.ts`, `tests/checks/{error-table-sync,exit-code-literals,forbidden-literals,privacy-literals,secret-read-boundary}.test.ts`, and `tests/boundaries` run unchanged and are the proof that this additive command changed nothing else.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure/brief-contract.test.ts`; `pnpm typecheck` | `tests/structure/brief-contract.test.ts`; `packages/core/src/contracts/brief.ts`, `packages/core/src/domain/brief.ts` | TC-BRIEF-001 |
| Command surface | `bun test tests/structure/brief-contract.test.ts tests/behaviour/brief-command.test.ts` | `packages/cli/src/commands/brief.ts`, `packages/cli/src/edge.ts` | TC-BRIEF-002 |
| Boundary, purity, no-LLM | `bun test tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/workspace-entrypoints.ts`; `pnpm check:boundaries`; static scan | `tests/boundaries/**`, `tests/structure/brief-imports.test.ts`, `.dependency-cruiser.cjs` | TC-BRIEF-003 |
| Shared truth | `bun test tests/behaviour/brief-shared-truth.test.ts` | `tests/fixtures/brief/**` over `tests/fixtures/status/harness.ts` | TC-BRIEF-004, TC-BRIEF-016 |
| Read cost | `bun test tests/behaviour/brief-read-cost.test.ts` | injected reader + transport recorders | TC-BRIEF-005 |
| Output and bounds | `bun test tests/behaviour/brief-output.test.ts` | `tests/fixtures/brief/harness.ts` | TC-BRIEF-006 |
| Anchors | `bun test tests/behaviour/brief-anchors.test.ts` | shared fact cases | TC-BRIEF-007, TC-BRIEF-008 |
| Placeholders | `bun test tests/behaviour/brief-placeholders.test.ts` | closed catalog + corpus | TC-BRIEF-009 |
| Negative controls | `bun test tests/behaviour/brief-negative-controls.test.ts` | `tests/fixtures/status/matrix/cases.ts` parity + brief cases | TC-BRIEF-010 |
| Envelope and exits | `bun test tests/behaviour/brief-envelope.test.ts`; `packages/testkit/src/result-conformance.ts` | in-process CLI composition | TC-BRIEF-011, TC-BRIEF-012 |
| Error contract and sync | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts`; `bun run scripts/checks/error-table-sync.ts` | existing suites (update) | TC-BRIEF-013 |
| Golden | `bun test tests/golden/brief.test.ts` | `tests/fixtures/brief/golden/**` | TC-BRIEF-014, TC-BRIEF-015 |
| Corpus completeness | `bun test tests/behaviour/brief-corpus.test.ts` | `tests/fixtures/brief/corpus/**` | TC-BRIEF-016 |
| Determinism | `bun test tests/behaviour/brief-determinism.test.ts` | replay + content scanners | TC-BRIEF-017 |
| Read-only, credential posture, redaction | `bun test tests/behaviour/brief-readonly.test.ts`; `bun test tests/golden/redaction.test.ts` | `guardStore`, repo io, fixture transport | TC-BRIEF-018, TC-BRIEF-019 |
| Performance | `bun test tests/behaviour/brief-performance.test.ts` | injected clock, cap-sized facts | TC-BRIEF-020 |
| Non-vacuity | `bun test tests/checks/brief-mutants.test.ts` | `tests/fixtures/brief/mutants/**` | TC-BRIEF-021 |
| Documentation posture | content check + review | `doc/spec/features/feature-brief.md`, `.../m1/commands/brief.md`, registry | TC-BRIEF-022 |
| Aggregate | `pnpm check` | repo root; unchanged gates | All TCs (regression half) |

### 4.1 In-Process Brief Harness Contract (binding for every TC)

1. **Hermetic.** Every suite imports production modules and injects fakes. No suite resolves a host, opens a socket, reads a real credential, reads `$HOME`, spawns a child process, or touches the live worktree. Provider behaviour is a committed fixture through the existing `createFixtureTransport` pattern; the throwing-fetch guard may be installed as a second line of defence.
2. **One shared fact model.** Because DEC-1 makes the collector state the single source of truth, the harness defines `BriefCase = { name, facts: StatusFacts, expected }` over the existing `tests/fixtures/status/harness.ts` builders. A single `facts` object is handed to *both* `statusRuntime(facts)` and `briefRuntime(facts)`; each runtime has its own call recorder. This is the same-facts fixture model AC-F1-1 requires — never two independently constructed fact sets.
3. **In-process CLI composition.** Both commands run through the shared `runCli` composition with buffer streams, a fixed clock (`NOW_ISO`/`NOW_MS`), a fixed `runId`, a tick clock whose values are constant per invocation, and `SYNTHETIC_BRAND`. No spawned binary.
4. **Recorded claims over inference.** Where an AC concerns what the brief claims, the test asserts the claim as parsed data (surface states, action ids, ages, placeholder entries, truncation), never a guess from a rendered substring. Human-text assertions are limited to bounds, marker presence, and forbidden-token absence.
5. **Goldens are read-only.** Golden files are opened read-only, compared byte-for-byte, and their `mtimeMs` is asserted unchanged after the suite runs. Regeneration is a separate explicit command, never a test side effect.
6. **Temp roots only.** Any test needing a real filesystem (state store, whole-tree scans, mutants) uses `mkdtemp` under `$TMPDIR` or a committed read-only fixture; the live tree is never written.

### 4.2 Shared-Truth Claim Map (binding for AC-F1-1, DM-4)

Each brief claim class has exactly one oracle. A brief claim outside this map is a **brief-only fact** and fails.

| Brief claim class | Digest counterpart | Equality rule |
|---|---|---|
| Surface state | The corresponding digest section's `state` | Strict token equality over the closed five-value set. A surface with no digest section (the three placeholders) uses the catalog oracle in §4.3. |
| Surface counts | The corresponding digest section's `counts` (`observed`, `unknown`, `total`, `omitted`) | Strict numeric equality; a surface may render a subset, but every number it renders must equal the digest's number for the same population. |
| Surface truncation | The corresponding digest section's `truncated` / non-zero `omitted` | A truncation marker exists if and only if the digest section reports truncation; a marker on an untruncated surface is a failure. |
| Ready-to-merge action identity | `changes-and-prs` rendered pull-request item identity (bounded to the 8-item cap) | The action's reference must be present in the digest's rendered `changes-and-prs` items. An approved pull request omitted by the cap is never claimed (§4.4). |
| Ready-to-merge evidence | That item's `deliveryState`, `draft`, and item-level `reviewState` signal | The cited evidence must reproduce the digest item's own values; no derived verdict field. |
| Owner-gate age | Digest exposes `ageDays` on **stalls** and **parked work** only; owner-hand-back items expose no age (GAP-T1) | Where the digest exposes an age: strict equality. Where it does not: equality with an independent derivation from the same injected `WorkItem.updatedAt` using the digest's declared parse-and-floor rule and injected `nowMs` (§4.5). |
| Placeholder justification | `lanes-or-queue` for `lane-queue-engine`; declared capability absence for the other two | §4.3. |
| Repository binding reference | The digest's `repository` binding | Strict equality of the binding reference; a binding the digest reports `unavailable` is never rendered as an observed binding. |
| Injected generation time | The digest's `generatedAt` | Equal for the same injected facts; never rendered in human text. |

**Zero-claim rule.** The set of brief surface ids is a declared closed set (§4.6); the set of placeholder capabilities is the closed catalog (§4.3). A surface or capability not in a declared set is a new fact and fails TC-BRIEF-004.

### 4.3 Placeholder Catalog Oracle (binding for AC-F3-1, DEC-5, DEC-6)

| Capability id | Owning story | Required collector evidence state | Justification | Forbidden renderings |
|---|---|---|---|---|
| `typed-questions` | M1-S16 | `not-delivered` | The typed blocker channel does not exist in v0; the blocker-question surface is a named placeholder | `observed`, empty list, `0`, any question record |
| `gate-sla-states` | M1-S5 | `not-delivered` | Ages render; classifications do not; M1-S5 ranks after the brief | any `slaState` token (`escalated`, `overdue`, `breached`, …), any expiry |
| `lane-queue-engine` | M1-S17 | `not-delivered` | The digest's `lanes-or-queue` section is always `not-delivered` | `observed`, empty queue, `0`, any queue/lane item |

Additional invariants: the catalog is exactly three entries and contains no `spend` entry (DEC-5); ids and stories are stable; adding a fourth entry in a temp copy fails the contract test; every entry carries a non-empty capability id, owning story, and state; a placeholder is never counted as an action.

### 4.4 Ready-to-Merge Predicate Oracle (binding for AC-F2-1, DEC-7)

The convention is the shipped queue-ready `merge-ready` rule: observed `approved` review state on a non-draft open pull request.

| Fact | Ready-to-merge claim | Surface state |
|---|---|---|
| `changes-and-prs` item with `deliveryState === "approved"`, `draft === false`, item-level `reviewState === "observed"`, section `observed` or `degraded` | **Allowed**; cites that item's existing bounded evidence | unchanged |
| Item-level `reviewState === "unknown"` (declared review signal unavailable, or source did not supply it) | **Forbidden** | `degraded` with `signal-unavailable` (or the section's own state) |
| `deliveryState` is `draft`, `open`, `changes-requested`, `merged`, or `closed` | **Forbidden** | unchanged |
| Pull-request read failed; section `degraded`/`unknown` | **Forbidden**; never a zero claim | `degraded`/`unknown` with the digest's reason |
| No repository binding; section `unavailable` | **Forbidden** | `unavailable` |
| Approved pull request exists but was dropped by the 8-item cap | **Forbidden** (not part of the digest's bounded evidence) | unchanged **and** the surface carries its truncation marker |
| Section `observed` with zero approved pull requests | Surface is `observed` and explicitly empty (verified-empty) | `observed` |

The action record carries identity and citing evidence only. It must carry no boolean verdict, authorization, or "safe to merge" field; the wording half is checked manually in TC-BRIEF-022.

### 4.5 Owner-Gate Age Oracle (binding for AC-F2-2)

| Injected fact | Age claim | SLA claim |
|---|---|---|
| Parseable provider-native `updatedAt`, `nowMs >= updatedAt` | `floor((nowMs - updatedAt) / 86_400_000)` days | none — `gate-sla-states` placeholder rendered |
| `updatedAt` absent | unknown (explicit unknown signal) | none |
| `updatedAt` unparseable | unknown | none |
| `updatedAt` in the future | no negative age may be rendered; unknown (assert the age is null or non-negative) | none |
| Hand-back family signal `unavailable` | no ages at all; the surface is `unavailable`, never empty | none |
| Hand-back family `observed` with zero items | `observed` + verified-empty | none |
| Hand-back item dropped by the 4-per-family cap | not claimed; truncation marker present | none |

No fabricated value may appear for an unknown age: not `0`, not `"0d"`, not an empty string.

### 4.6 Closed Render-Surface Set (binding for AC-F4-1, DM-5)

The closed render-surface set is exactly **nine ids**: the six digest-section surfaces (`tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`, `providers`, `parked-work`), each carrying its digest section's state, plus the three DEC-6 placeholder surfaces (`typed-questions`, `gate-sla-states`, `lane-queue-engine`).

Decision-first ranking is not a surface property. Ready-to-merge and owner-gate ages are ranked anchored-action **groups** carried as DM-2 payload records — each action cites the digest item evidence it projects and the state of the surface it derives from — and they are **not** surface ids and never add a tenth surface. The blocker-questions block **is** the `typed-questions` placeholder surface, and `gate-sla-states` renders beside the owner-gate ages block; both are members of the nine-id set, not additional surfaces.

The correspondence is fixed: `owner-gate ages → tracker`; `ready-to-merge → changes-and-prs`; `typed-questions → the blocker-questions block`; `gate-sla-states → beside the owner-gate ages block`; `lane-queue-engine → lanes-or-queue`; the remaining context surfaces map one-to-one. Every digest section state therefore has exactly one corresponding brief surface, which is what makes a failed collector impossible to hide while AC-F4-1 requires the brief to carry "exactly the digest's section state".

### 4.7 Failed/Absent-Read Negative-Control Matrix (binding for AC-F4-1)

Each row is one case in `tests/fixtures/brief/cases.ts`, driven through the shared fact model, and asserts (a) the surface state equals the digest section state and (b) the forbidden token is absent.

| Control | Digest state | Brief surface requirement | Forbidden |
|---|---|---|---|
| Failed issues/PR/check-runs read | `unknown` / `degraded` per matrix | same token; names the reason in place | clear, `observed`, `0`, "nothing to do" |
| Missing credential | `unknown` (`credential-unavailable`) | same | available, observed, zero |
| Unresolved commit SHA | `ci` `unknown` (`commit-unresolved`) | same; no green CI claim | succeeded, green, passed |
| Unavailable repository binding | `unavailable` (`addressing-unresolved`) | same; no binding rendered as observed | owner/name rendered as fact |
| Absent local PM context | `parked-work` `unavailable` | same | empty parked list, `0` |
| Malformed local PM context | `parked-work` `unknown` | same | empty parked list, `0` |
| Torn park fold | `providers` `degraded` | same; no "no parks" claim | available capacity |
| Undeclared provider chain | `providers` `unavailable` | same | zero providers available |
| Unresolved declared chain | `providers` `unknown` | same | available |
| Tracker family signal unavailable | `tracker` `degraded` + family `unavailable` | same; owner-gate ages surface not observed | empty family as "no blocked work" |
| Non-credential-reference instance (anonymous) | tracker/ci `unknown`, changes `degraded` | same, exactly the digest's fixed guard outcome | observed, available |
| Source at declared page limit | section `truncated` | marker present | silent completeness |
| Verified-empty observed section | `observed` + `observed-empty` | `observed` and explicitly empty | clear/green/available wording |
| Fully observed world | all `observed` | all surfaces `observed` | fabricated unknown |

### 4.8 Envelope and Exit Oracle (binding for AC-F5-1, DEC-2)

| Outcome | Envelope | Exit | `data` |
|---|---|---|---|
| Any collector state, including every read failed and no binding | success; no `error` key; `assertEnvelopeContract` empty | `0` | Full brief payload with all surfaces named and placeholders at `not-delivered` |
| Rejected invocation (positional, unknown flag) | failure `fallback.invocation` | `1` | none; zero reads |
| Containment / hostile handler throw | failure `fallback.internal` | `2` | none |
| `status.collector.<id>.unavailable` | must not exist anywhere (error table, payload, evidence, docs) | n/a | n/a |

Exactly one envelope per run. `schemaVersion` is the shipped `delivery.result.v1`; `timing.totalMs` is the shipped shape (the proposed man-page `{started, durationMs}` example is illustrative, not binding). Zero new error-table rows, zero new domain kinds, zero new configuration keys.

### 4.9 Prohibited Test Dependencies (explicit)

- **No live network or credential.** No suite resolves a host, opens a socket, or reads a real token; the GitHub reads are injected fixtures.
- **No child process.** The repository binding and HEAD facts come from a fake `RepositoryIo`; no suite spawns `git`.
- **No live-repository mutation.** Temp roots and committed read-only fixtures are the only filesystem surfaces; `git status --porcelain` is captured before and after the battery.
- **No wall clock or ambient environment for correctness.** Time is `NOW_MS`; ids are fixed; brand is `SYNTHETIC_BRAND`.
- **No moving-base diff.** Every assertion reads the current tree, a committed fixture, or a temp copy.
- **No real content in fixtures.** Synthetic refs, entity ids, titles, labels, SHAs, and small counts only; the single secret canary is fabricated and exists only to prove the redaction boundary.

### 4.10 Non-Vacuity Contract (binding for every negative, absence, cap, and placeholder scenario)

1. **Plant the positive before asserting the absence.** An approved pull request, a hand-back item with a parseable timestamp, a trivially-empty family, and the three catalog entries are asserted present in the fixture before the test asserts they are absent, omitted, or unknown.
2. **Pair every negative with a live control in the same test or the same file.** An unknown review signal sits beside an observed approval; a cap-dropped approved pull request sits beside an in-cap one; an unavailable hand-back family sits beside an observed-empty one.
3. **A deliberately broken guard must fail the suite, naming the case.** `tests/checks/brief-mutants.test.ts` imports temp copies of the projection/render modules through a file URL with one named guard disabled and asserts the mutant produces the prohibited observable with a message naming the case. If the real module also produced nothing, the meta-check fails.
4. **Caps are asserted at and above the threshold.** Approved-pull-request, hand-back, and dense-world cases are run at exactly the cap, one above, and far above.
5. **Scan scope is non-empty.** Import, spawn, mutation, secret, and literal scans assert a positive file/call count before asserting zero violations.
6. **No golden is self-fulfilling.** Each golden comparison is paired with a mutation control that changes one fact and asserts inequality, then restores and asserts equality.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-BRIEF-001 | Payload contract, closed catalog, bounds by reference, inventory registration | Regression | Critical | High | AC-F3-1, NFR-1, NFR-8, DM-1..DM-4 |
| TC-BRIEF-002 | Command surface and grammar rejection before any read | Negative | Critical | High | AC-F5-1, AC-F1-1, F-1 |
| TC-BRIEF-003 | Render-path boundaries, purity, and no-LLM/no-network capability | Regression | Critical | High | AC-F6-2, NFR-5, NFR-6, NFR-8 |
| TC-BRIEF-004 | Same-facts shared-truth agreement with zero brief-only facts | Happy Path | Critical | High | AC-F1-1, AC-F4-1, DM-4 |
| TC-BRIEF-005 | Read-cost parity: zero brief-specific reads | Regression | Critical | High | AC-F1-1, NFR-3 |
| TC-BRIEF-006 | One-screen bounds, truncation markers, decision-first order | Edge Case | Critical | High | AC-F1-2, NFR-1 |
| TC-BRIEF-007 | Ready-to-merge anchor: observed approval only, never a verdict | Happy Path | Critical | High | AC-F2-1, DM-2 |
| TC-BRIEF-008 | Owner-gate ages: parseable only, unknown otherwise, no SLA state | Edge Case | Critical | High | AC-F2-2, DM-2 |
| TC-BRIEF-009 | Closed three-entry placeholder catalog renders named, never zero | Happy Path | Critical | High | AC-F3-1, DM-3 |
| TC-BRIEF-010 | Exhaustive failed/absent-read negative controls | Negative | Critical | High | AC-F4-1, DM-4 |
| TC-BRIEF-011 | Collector unavailability is digest data at exit 0 | Negative | Critical | High | AC-F5-1 |
| TC-BRIEF-012 | Exit projection and containment identities only | Regression | Critical | High | AC-F5-1 |
| TC-BRIEF-013 | Error-table, domain-kind, and configuration-key stability | Regression | Critical | High | AC-F5-1, NFR-7 |
| TC-BRIEF-014 | Golden human brief bytes and golden immutability | Regression | Critical | High | AC-F1-2, AC-F6-1, NFR-2 |
| TC-BRIEF-015 | Golden `--json` envelope bytes and machine bound | Regression | Critical | High | AC-F5-1, AC-F6-1, NFR-2 |
| TC-BRIEF-016 | Corpus completeness over every surface, state, and placeholder | Regression | Critical | High | AC-F3-1, AC-F4-1, AC-F6-1 |
| TC-BRIEF-017 | Determinism replay and human-content discipline | Regression | Critical | High | AC-F6-1, NFR-2 |
| TC-BRIEF-018 | Read-only execution, zero spawn, credential-reference guard | Regression | Critical | High | AC-F6-3, NFR-6 |
| TC-BRIEF-019 | Redaction chokepoint over envelope and human text | Regression | Critical | High | AC-F6-3 |
| TC-BRIEF-020 | Pure-projection performance and bounded work | Performance | Important | Medium | NFR-4, AC-F1-1 |
| TC-BRIEF-021 | Non-vacuity meta-check: broken guards fail naming the case | Regression | Critical | High | All ACs, NFR-5 |
| TC-BRIEF-022 | Documented posture consistency with the shipped contract | Manual | Important | High | AC-F5-1, DEC-2 |

`TC-BRIEF-*` is a new prefix with no prior use in the repository; no existing TC identifier is reused for a different scenario.

### 5.2 Scenario Details

#### TC-BRIEF-001 - Payload contract, closed catalog, bounds by reference, inventory registration

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, DM-1, DM-2, DM-3, DM-4, AC-F3-1, NFR-1, NFR-8
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/brief-contract.test.ts`; `packages/core/src/contracts/brief.ts`
**Tags**: @backend

**Preconditions**:

- The brief contracts module exports the payload type, the surface-id set, the placeholder catalog, and the bounds.
- The status contracts export `STATUS_SECTION_ORDER`, `STATUS_SECTION_STATES`, `STATUS_MAX_HUMAN_LINES`, `STATUS_MAX_HUMAN_BYTES`, and `STATUS_MAX_MACHINE_BYTES`.
- `tests/structure/inventory.json` carries a per-file entry list and `EXECUTABLE_ALLOWANCES`.

**Steps**:

1. Parse the contracts module with the TypeScript AST and assert every top-level statement is a type alias, interface, `import type`, `export`, or an `as const` declaration; assert zero executable statements, zero calls, zero `new`.
2. Assert the payload declares `delivery.brief.v1` and the seven DM-1 members; assert the surface-id set is exactly the §4.6 set and is closed.
3. Assert the placeholder catalog is exactly the §4.3 three entries with stable ids, owning stories, and `not-delivered`; assert no `spend` entry exists (DEC-5).
4. Assert the brief bounds are consumed *by reference* from the status contracts and that the numeric values are 24 / 4096 / 65536; assert no literal re-declaration of `STATUS_*` names or of the five-value state list (single-vocabulary-home scan).
5. Assert every new source file is present in `tests/structure/inventory.json` and every new executable export is in `EXECUTABLE_ALLOWANCES`; run the content-inventory suite.
6. Assert zero product or binary literals in the new contract and domain modules (seeded-literal control must fail).

**Expected Outcome**:

- The contract is declaration-only, the catalog is closed at three, the bounds and vocabulary are borrowed rather than duplicated, and inventory/literal gates are green.

**Notes / Clarifications**:

- Export names are delivery-bound; the catalog contents, the closed surface set, the bound values, and the state vocabulary are not.

#### TC-BRIEF-002 - Command surface and grammar rejection before any read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F5-1, AC-F1-1, DM-1
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-command.test.ts`; `packages/cli/src/commands/brief.ts`, `packages/cli/src/edge.ts`
**Tags**: @backend

**Preconditions**:

- The command is composed beside the existing top-level commands in the CLI edge with a recorded `BriefCommandRuntime`.
- The shared parser rejects unknown flags and excess positionals.

**Steps**:

1. Assert the composed command key is exactly `brief` and that the definition declares no value-bearing flags, no conflicts, and `positionals.max` of `0`; assert `--json` is the only accepted flag and adds no command behaviour.
2. Run `brief extra`, `brief GH-228`, `brief --bogus`, and `brief --json extra`; assert `fallback.invocation`, exit `1`, exactly one failure envelope, and a **zero-entry** reader/transport call log.
3. Run `brief` and `brief --json` on the fully observed case; assert exit `0`, at least one reader call, and that human mode uses the renderer hook (not raw JSON).
4. Assert the handler owns no stream write and chooses no exit code (it returns data only), matching the status command contract.
5. Assert the command performs no command-specific read: the reader member set invoked is a subset of the status runtime's member set.

**Expected Outcome**:

- One command, no positionals, `--json` only; every malformed invocation fails before any read; both valid modes render.

#### TC-BRIEF-003 - Render-path boundaries, purity, and no-LLM/no-network capability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-5, NFR-6, NFR-8, DEC-3
**Test Type(s)**: Unit, Static, Contract
**Automation Level**: Automated (plus a recorded manual review half)
**Target Layer / Location**: `tests/structure/brief-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,workspace-entrypoints}.ts`
**Tags**: @backend, @no-llm

**Preconditions**:

- Detector helpers exist in the status-imports pattern (`specifiersOf`, `callNames`, `contractsDataOnly`, `domainPure`, `commandCoreOnly`, `brandLiteralViolations`).
- `.dependency-cruiser.cjs` declares the tier and runtime rules; `package.json` and the lockfile are the dependency authorities.

**Steps**:

1. Assert the brief contracts module imports nothing runtime (`node:*`, `bun:*`, adapters) and the brief domain module imports only `#contracts`, `#domain/*`, and relative modules; assert zero `fetch`, `Date.now`, `Math.random`, `performance.now`, `process.env`, `Bun.env`, `readFileSync` calls.
2. Scan the brief render path for model/network capability: `fetch`, `node:http`, `node:https`, `node:net`, `node:dns`, `node:child_process`, `undici`, and any model-SDK specifier (`openai`, `anthropic`, `@anthropic-ai/*`, `ai`, `langchain*`, `ollama*`). Assert zero occurrences with a non-empty file count.
3. Assert the command module imports only `@delivery-os/core`, `@delivery-os/core/contracts`, and relative modules; assert `commandCoreOnly` is empty.
4. Assert no new runtime dependency, no new package, and no new subpath: the workspace manifests, lockfile, and `tests/structure/subpaths.test.ts` are unchanged; `workspace-entrypoints.ts` is clean.
5. Assert a seeded `import "node:http"` and a seeded `fetch(...)` in a temp copy each fail by name; assert the scan's file count is greater than zero.
6. Run `pnpm check:boundaries` and `bun run scripts/checks/ambient-globals.ts`; record the results.

**Expected Outcome**:

- The render path has no model-call and no network capability, no new dependency or subpath, and every detector has a failing control.

**Notes / Clarifications**:

- AC-F6-2 also names review. TC-BRIEF-022 records the review checklist item "no LLM or model call in the brief render path"; this TC is the mechanical half.

#### TC-BRIEF-004 - Same-facts shared-truth agreement with zero brief-only facts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, DM-4, AC-F1-1, AC-F4-1, DEC-1, DEC-4
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-shared-truth.test.ts`; `tests/fixtures/brief/cases.ts`
**Tags**: @backend

**Preconditions**:

- One `StatusFacts` object per case is built with the status harness builders and handed to both `statusRuntime(facts)` and `briefRuntime(facts)`.
- The §4.2 claim map and the §4.6 surface set are the oracle.

**Steps**:

1. For every case in the shared model (fully observed, GitHub degraded slice, each failed read, each absence, each guard outcome, cap-sized, verified-empty), render the digest and the brief from the **same** `facts` object.
2. For each brief surface, assert its state token equals the digest section state for the mapped section; assert every rendered count equals the digest section's count for the same population; assert every truncation marker matches the digest's `truncated`/`omitted`.
3. Assert every ready-to-merge action reference exists in the digest's rendered `changes-and-prs` item set and that its cited evidence reproduces that item's `deliveryState`, `draft`, and review-signal state.
4. Assert every placeholder entry matches §4.3 and that the lane/queue entry's state equals the `lanes-or-queue` section state.
5. Assert the surface-id set equals the declared closed set (no extra, no missing) and the placeholder capability set equals the closed catalog — i.e. zero brief-only facts.
6. Assert the injected generation time equals the digest's `generatedAt` and that the repository binding reference equals the digest's binding or is absent when the digest's binding is unavailable.
7. Run a mutant that injects a fabricated surface state; assert it fails naming the surface.

**Expected Outcome**:

- 100 % agreement on every shared claim across every case, with a proven zero-extra-fact property.

#### TC-BRIEF-005 - Read-cost parity: zero brief-specific reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-3, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-read-cost.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording `BriefCommandRuntime` and a recording fixture transport/`RepositoryIo`, plus a recording provider config/park fold.
- The status invocation's recorded call set is the baseline.

**Steps**:

1. Run `status --json` on the fully observed case; record the ordered reader call set, the transport request count and methods, the park fold count, and the configuration resolve count.
2. Run `brief --json` on the **same** facts with fresh recorders; assert the reader member set is identical (no brief-only member) and the counts equal the baseline: at most 3 outbound GETs, exactly 1 park fold, exactly 1 configuration resolve.
3. Assert every transport request is a `GET` to one of the three declared endpoints; assert no quota, announcement, pagination, or retry request appears.
4. Assert the pure projection consumes no reader: call the projection twice with the same facts and assert the recorder log does not grow.
5. Assert zero daemon/control-socket interaction and zero pagination loop (request count is invariant when the fixture page is at the declared limit).
6. Assert a brief-only reader member injected into the composition is detected and fails by name.

**Expected Outcome**:

- Net read cost is identical to one status invocation; the brief adds no read of its own and no retry path.

#### TC-BRIEF-006 - One-screen bounds, truncation markers, decision-first order

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-1, OQ-1
**Test Type(s)**: Unit, Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-output.test.ts`
**Tags**: @backend

**Preconditions**:

- Cap-sized fact builders exist for approved pull requests, hand-back items, dense tracker families, dense CI runs, dense providers, dense parks, and dense parked work.
- The declared bounds are 24 human lines, 4096 human bytes, 65536 machine `data` bytes.

**Steps**:

1. Render human mode on the fully observed cap-sized case; assert the count of non-empty lines is ≤24 and `Buffer.byteLength(human, "utf8")` is ≤4096.
2. Render `--json`; assert `Buffer.byteLength(JSON.stringify(envelope.data), "utf8")` is ≤65536 and the envelope total is recorded but not separately capped.
3. Assert the decision-first order: the three anchored surfaces precede every context surface, and context surfaces follow the digest's fixed section order.
4. Assert truncation: for every surface whose digest section reports `omitted > 0` or a source-at-limit signal, a non-empty marker exists; for every surface with zero omissions, no marker exists.
5. Exercise the at-cap, one-above-cap, and far-above-cap cases; assert ordering survives the bound (ordering wins over bound pressure per OQ-1) and that the report records bound pressure when the ordering cannot fit.
6. Assert a renderer that drops the ordering or omits the marker fails; assert an over-cap renderer fails on the byte assertion.
7. Assert the human text is plain deterministic text: no ANSI escape sequence, no control character other than `\n`, and no carriage return; grammar itself is delivery-bound (OQ-1).

**Expected Outcome**:

- Every fact set yields one bounded screen with explicit, truthful truncation and preserved decision-first order.

#### TC-BRIEF-007 - Ready-to-merge anchor: observed approval only, never a verdict

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-2, AC-F2-1, DEC-7, NG-1
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-anchors.test.ts`
**Tags**: @backend

**Preconditions**:

- The shared fact model can produce: approved non-draft open PR; draft PR; `changes-requested`, `open`, `merged`, `closed` PRs; unknown item-level review signal; declared `reviewState` unavailable; failed pull-request read; unavailable binding; verified-empty changes section; approved PR dropped by the 8-item cap.

**Steps**:

1. For the observed-approved case, assert a ready-to-merge action exists whose reference is the approved item's identity and whose evidence reproduces that item's `deliveryState`, `draft: false`, and `reviewState: observed`.
2. Assert the action carries no verdict, authorization, boolean "safe", or gate-result field; assert the payload has no `verdict`/`authorized`/`gate` member anywhere.
3. For each forbidden case in §4.4, assert **zero** ready-to-merge actions and that the surface carries its five-value state with the digest's reason.
4. For the cap-dropped approved pull request, assert zero actions **and** a truncation marker on the surface; then raise the cap-equivalent fixture so the same item is in-cap and assert the action appears — proving the omission, not the fixture, caused the absence.
5. For the verified-empty observed case, assert the surface is `observed` and explicitly empty, and that the human text does not use clear/green/available wording.
6. Assert the queue-ready `merge-ready` classification is not imported or duplicated: the brief imports no queue-ready domain module.

**Expected Outcome**:

- Ready-to-merge appears exactly when the digest carries observed approval on a non-draft open pull request, always cites digest evidence, and never reads as a verdict.

#### TC-BRIEF-008 - Owner-gate ages: parseable only, unknown otherwise, no SLA state

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, F-4, DM-2, AC-F2-2, DEC-6
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-anchors.test.ts`
**Tags**: @backend

**Preconditions**:

- Hand-back builders can set `updatedAt` to a parseable value, omit it, set an unparseable value, and set a future value.
- The injected clock is `NOW_MS`.

**Steps**:

1. For a parseable `updatedAt`, assert the rendered age equals `floor((NOW_MS - updatedAt) / DAY_MS)` and that the same value matches an independent derivation over the injected facts (the §4.5 oracle).
2. For the absent and unparseable cases, assert the age signal is unknown: not `0`, not `"0"`, not an empty string, not a fabricated number; assert the surface still names its state.
3. For a future `updatedAt`, assert no negative age is rendered and no escalation is invented.
4. Assert no `slaState`, `escalated`, `overdue`, `breached`, or expiry token appears anywhere in the payload or human text, and that the `gate-sla-states` placeholder entry renders in the same payload.
5. For the hand-back family `unavailable` case, assert zero ages and an `unavailable` surface (not an empty observed surface).
6. For the verified-empty observed family, assert `observed` + empty.
7. For the 4-per-family cap, assert omitted items are not claimed and the truncation marker is present.
8. Run an age-fabricating mutant (defaults unknown to 0); assert it fails naming the case.

**Expected Outcome**:

- Ages derive only from present, parseable provider-native timestamps; unknown stays unknown; SLA classification is a named placeholder, never a state.

#### TC-BRIEF-009 - Closed three-entry placeholder catalog renders named, never zero

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-3, AC-F3-1, DEC-5, DEC-6, NG-3
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-placeholders.test.ts`
**Tags**: @backend

**Preconditions**:

- The v0 world has M1-S5, M1-S16, and M1-S17 unbuilt; spend (M1-S19) is out of scope.

**Steps**:

1. Render the fully observed case; assert exactly three placeholder entries with the §4.3 ids, stories, and `not-delivered` state.
2. Render human mode; assert each placeholder appears as a named line containing its capability and owning story, and that none of the three surfaces is rendered as an empty list, `0`, `none`, or `observed`.
3. Assert the blocker-question surface is the `typed-questions` placeholder and carries no question record; the owner-gate surface carries no SLA state and the `gate-sla-states` placeholder instead; the lane/queue surface is `not-delivered` and equals the digest's `lanes-or-queue` state.
4. Assert no `spend` placeholder or cost surface exists anywhere (DEC-5), and that a temp-added fourth catalog entry fails the contract test.
5. Assert placeholders are not counted as actions and do not inflate any surface count.
6. Assert the placeholder list is stable across replays and independent of fact permutation.

**Expected Outcome**:

- All three unbuilt capabilities are visible by name with their owning story and evidence state; none is silent.

#### TC-BRIEF-010 - Exhaustive failed/absent-read negative controls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-4, AC-F4-1, RSK-4
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-negative-controls.test.ts`; `tests/fixtures/brief/cases.ts`
**Tags**: @backend

**Preconditions**:

- The §4.7 matrix rows are declared as cases; `tests/fixtures/status/matrix/cases.ts` parity is available as the digest-side oracle.
- The guard cases reuse `anonymousInstance()` and `unavailableBinding()` from the status harness.

**Steps**:

1. For every row of the §4.7 matrix, render digest and brief from the same facts and assert the mapped surface state is token-identical to the digest section state.
2. Assert the specific reason is named in place where the digest exposes one; assert no failed, absent, unattempted, or unresolved read is rendered as `observed`, clear, green, available, or `0`.
3. Assert the anonymous-instance case reproduces the digest's fixed guard outcome exactly (tracker `unknown`, ci `unknown`, changes `degraded`, local context untouched).
4. Assert the at-limit source case carries a marker and that the near-limit control does not — proving the marker tracks truncation rather than always rendering.
5. Assert the completeness meta-check fails when a matrix row's expected state is corrupted, naming the case.
6. Assert the fully observed control renders every surface observed (the controls are not passing because the command is inert).

**Expected Outcome**:

- Every digest failure mode maps to exactly the digest's state on the brief, with zero false all-clear.

#### TC-BRIEF-011 - Collector unavailability is digest data at exit 0

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DEC-2, RSK-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-envelope.test.ts`
**Tags**: @backend

**Preconditions**:

- The brief composition accepts a runtime whose every reader fails or returns an unavailable binding.
- `assertEnvelopeContract` from the testkit is available.

**Steps**:

1. Run `brief --json` with all reads failing; assert exit `0`, `assertEnvelopeContract(envelope)` is empty, and the envelope carries no `error` key.
2. Assert the payload is complete: every §4.6 surface is present, each carries its digest state, and all three placeholders are present at `not-delivered`.
3. Assert no `status.collector.<id>.unavailable` code appears in the envelope, payload, evidence, or error table; assert no exit-2 unavailability path exists.
4. Run the same case in human mode; assert exit `0`, bounds hold, and every affected surface names its gap in place.
5. Repeat with a missing credential, an unavailable binding, and an anonymous instance; assert the same exit-0 posture and the same absence of fabricated claims.
6. Assert exactly one envelope per run and that stderr carries no machine envelope.

**Expected Outcome**:

- Collection failure is data, not failure: exit `0`, one valid success envelope, named surfaces, zero placeholder inflation.

#### TC-BRIEF-012 - Exit projection and containment identities only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DEC-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-envelope.test.ts`
**Tags**: @backend

**Preconditions**:

- `projectExitCode` and the classification helpers are unchanged; `exit-code-literals` scan is available.

**Steps**:

1. Assert success (including degraded/unavailable collectors) projects exit `0`.
2. Assert a rejected invocation projects `fallback.invocation` at exit `1`.
3. Assert a throwing/hostile handler body contains as `fallback.internal` at exit `2` and still emits exactly one envelope.
4. Assert `fallback.invocation` and `fallback.internal` are existing error-table entries and that the brief adds no new classification path.
5. Assert no exit literal appears outside the CLI projection (`bun run scripts/checks/exit-code-literals.ts` green, seeded literal fails).
6. Assert the machine `exitCode` field equals the process exit code for every case above.

**Expected Outcome**:

- The brief's exit surface is exactly the shipped `{0,1,2}` projection with no new identity.

#### TC-BRIEF-013 - Error-table, domain-kind, and configuration-key stability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-7, AC-F5-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (update), `tests/structure/error-table.test.ts`; `scripts/checks/error-table-sync.ts`
**Tags**: @backend

**Preconditions**:

- The documented and machine error tables are the two authorities; no `brief` domain kind exists.

**Steps**:

1. Run `bun run scripts/checks/error-table-sync.ts`; assert green with non-zero source/documented/reference counts (non-vacuity).
2. Assert `ERROR_TABLE` contains no `brief.*` code and `DOMAIN_KINDS` contains no `brief` kind; assert the row count equals the pre-change baseline.
3. Assert no code starting with `status.` exists (guarding the DEC-2 rejection of `status.collector.<id>.unavailable`).
4. Assert the configuration catalog is unchanged: no new key, no new environment variable, no new default position.
5. Assert a temp-copy row addition and a temp-copy documented-only addition each fail the sync check naming the offender.
6. Assert the brief's evidence/placeholder justifications use only existing codes or declared catalog data — no invented error identity.

**Expected Outcome**:

- Zero new rows, kinds, or keys; bidirectional sync green; the rejected identity is provably absent.

#### TC-BRIEF-014 - Golden human brief bytes and golden immutability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-2, AC-F6-1, NFR-1, NFR-2, OQ-1
**Test Type(s)**: Golden, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/brief.test.ts`; `tests/fixtures/brief/golden/human.txt`
**Tags**: @backend, @golden

**Preconditions**:

- The cap-sized case, the fixed clock, the fixed run id, and `SYNTHETIC_BRAND` are pinned.
- The golden file is committed and read-only.

**Steps**:

1. Render human mode for the cap-sized case; assert `stdout` equals the golden bytes exactly.
2. Assert the golden itself is within bounds (≤24 non-empty lines, ≤4096 bytes) and that every surface and placeholder line is present.
3. Assert the golden contains no timestamp, no raw payload fragment, and no generated prose marker; assert it uses the injected brand binary name and no product literal.
4. Assert a one-fact mutation changes the output, then restore the facts and assert equality again (live control).
5. Assert the golden files' `mtimeMs` are unchanged after the suite (the suite never rewrites goldens).
6. Assert regeneration is not reachable from the test: no write call targets the golden path.

**Expected Outcome**:

- The human screen is pinned byte-for-byte, in bounds, content-clean, and never self-rewritten.

#### TC-BRIEF-015 - Golden `--json` envelope bytes and machine bound

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-1, AC-F6-1, NFR-1, NFR-2
**Test Type(s)**: Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/brief.test.ts`; `tests/fixtures/brief/golden/envelope.json`
**Tags**: @backend, @golden

**Preconditions**:

- The same pinned clock, run id, and brand as TC-BRIEF-014.

**Steps**:

1. Run `brief --json` for the cap-sized case; assert `stdout` equals the golden bytes exactly.
2. Assert `assertEnvelopeContract` is empty, the success key set is exact, and no `error` key exists.
3. Assert `Buffer.byteLength(JSON.stringify(envelope.data), "utf8")` is ≤65536 and the recorded envelope total is stable.
4. Assert the payload carries `delivery.brief.v1`, the injected generation time, the binding reference, all surfaces, all three placeholders, and the truncation markers.
5. Assert a one-fact mutation changes the bytes and a restore reproduces them; assert the golden's `mtimeMs` is unchanged after the run.

**Expected Outcome**:

- The machine payload is pinned, contract-valid, and inside the declared bound.

#### TC-BRIEF-016 - Corpus completeness over every surface, state, and placeholder

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, AC-F4-1, AC-F6-1, RSK-3
**Test Type(s)**: Contract, Meta-check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-corpus.test.ts`; `tests/fixtures/brief/corpus/**`
**Tags**: @backend

**Preconditions**:

- Each corpus case declares, per surface, the expected state, reason set, counts, ordered action ids, placeholder entries, ages, and truncation flag.
- The status corpus under `tests/fixtures/status/corpus/**` is the shape precedent.

**Steps**:

1. Load every committed case and render the brief from its facts; assert every declared expectation exactly.
2. Run the completeness meta-check: every surface in §4.6 and every state its source section can take per the digest's derivation matrix has at least one case; every one of the three placeholders appears; every §4.7 negative control is named; no case declares an unknown surface.
3. Assert a corrupted state, count, ordered action id, age, placeholder story, or truncation flag fails by case name.
4. Assert the corpus contains no live-network, credential, or host-path dependency (fixtures are pure fact builders).
5. Assert the corpus file count is non-zero and the case-name set is stable (sorted deterministically).

**Expected Outcome**:

- Every surface, state, and placeholder is represented by a committed case whose corruption fails loudly.

#### TC-BRIEF-017 - Determinism replay and human-content discipline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-2
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-determinism.test.ts`
**Tags**: @backend

**Preconditions**:

- The runtime is rebuilt per run from the same facts; goldens exist for cross-checking.

**Steps**:

1. Run `brief --json` twice and `brief` twice on the same facts; assert byte-identical stdout per mode across both runs.
2. Rebuild the runtime between runs (fresh composition, same facts); assert byte-identical output again.
3. Assert the human text contains no ISO-8601 timestamp, no epoch number, no `runId`, no raw JSON fragment, and no provider payload token; assert the injected generation time appears only in machine `data`.
4. Assert the human text is a deterministic function of the payload: render twice from the same payload with the same brand and assert equality; render with a different injected brand name and assert only the brand token changes.
5. Assert fact-order permutation (tracker items, pull requests, providers, parks, parked work) does not change any bytes — ranking is by declared keys, never input order.
6. Assert a `Date.now()`-using renderer and a map-iteration-order renderer each fail the replay.

**Expected Outcome**:

- Identical inputs always produce identical bytes; human output carries no time, payload, or prose.

#### TC-BRIEF-018 - Read-only execution, zero spawn, credential-reference guard

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-6, RSK-1
**Test Type(s)**: Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-readonly.test.ts`
**Tags**: @backend

**Preconditions**:

- `guardStore` from `verify-support` wraps a temp state store and records `read`/`append`/`replaceDocument`/`acquireFence`/`releaseFence`.
- A fake `RepositoryIo` and the fixture transport are injected; the PM-context file lives in a temp dir.

**Steps**:

1. Run `brief --json`; assert the guarded store observed `read` and performed zero `append`, `replaceDocument`, `acquireFence`, `releaseFence`; assert a deliberate `acquireFence` throws a forbidden error (the guard is live).
2. Assert the transport saw only `GET`s to the three declared endpoints, with zero writes, zero quota, zero announcement, and zero retries.
3. Assert the PM-context bytes and `mtimeMs` are unchanged after the run.
4. Assert no brief module contains `node:child_process`, `spawn`, `spawnSync`, `execFile`, or `Bun.spawn`; assert the scan's file count is non-zero.
5. Run with `anonymousInstance()`; assert the composition refuses it before any GitHub read, that the local PM context is still read, and that the resulting state pattern matches the digest's guard exactly. Restore `statusInstance()` and assert normal states.
6. Assert the secret-read allowlist length is unchanged and names no brief file.

**Expected Outcome**:

- Zero writes, mutations, child processes, or network writes; the credential-reference guard behaves identically to status.

#### TC-BRIEF-019 - Redaction chokepoint over envelope and human text

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-readonly.test.ts`; `tests/golden/redaction.test.ts`
**Tags**: @backend, @security

**Preconditions**:

- A fabricated canary secret is registered through the injected `secrets` list (never a real credential).
- The canary can be made to appear in a reachable artifact: a workspace path, a PM-context path, and a provider evidence detail.

**Steps**:

1. Assert the canary is present in the injected fixture **before** asserting absence (non-vacuity).
2. Run `brief --json` and `brief` with the canary-bearing fixtures; assert the canary occurs zero times in stdout and stderr.
3. Assert the redaction runs on the single serialization path for both modes: both the envelope and the pre-rendered human text pass through `serialize`/`writeOutput`; assert a bypassing renderer fails the canary test.
4. Assert the output contains no raw payload body, no item title beyond the digest's own projection, no credential value, and no environment value.
5. Assert the canary does not leak through the placeholder justifications, the evidence strings, or the truncation markers.

**Expected Outcome**:

- The single redaction path covers machine and human output; no canary, secret, or raw payload escapes.

#### TC-BRIEF-020 - Pure-projection performance and bounded work

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, NFR-3, AC-F1-1
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/brief-performance.test.ts`
**Tags**: @backend, @perf

**Preconditions**:

- Cap-sized inputs for every source (tracker families, pull requests, CI runs, providers, parks, parked work).
- The projection is pure and clock-injected.

**Steps**:

1. Warm the projection once, then take five timed runs of the pure projection over cap-sized facts; assert the median is ≤50 ms (the `status-performance` pattern) and log the median, Bun version, and platform in the assertion message.
2. Assert the timing instrument is live: a 10 ms busy loop must measure ≥10 ms, so a frozen or stubbed clock cannot make the bound pass vacuously.
3. Assert the measurement is non-vacuous: assert the projection produced every surface and a non-zero action/placeholder count for the fixture.
4. Assert the work is bounded rather than merely fast: call counts are invariant across page-size changes at the declared limit, and there is no loop over an unbounded collection (structural assertion over the source).
5. Assert the same fixture's read counts equal TC-BRIEF-005's baseline (3 GETs, 1 park fold, 1 config resolve).

**Expected Outcome**:

- The projection is linear over capped input and inside the 50 ms bound, with bounded (not incidental) work.

#### TC-BRIEF-021 - Non-vacuity meta-check: broken guards fail naming the case

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: All ACs, NFR-5, §4.10
**Test Type(s)**: Unit, Meta-check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/brief-mutants.test.ts`; `tests/fixtures/brief/mutants/**`
**Tags**: @backend

**Preconditions**:

- Mutants are temp copies imported through a file URL, never executed against the live tree.
- Each mutant disables exactly one named guard.

**Steps**:

1. Import each mutant and assert it produces the prohibited observable: fabricated surface state; brief-only fact; unknown-as-zero count; placeholder rendered as observed/empty; `slaState` fabrication; age defaulted to 0; ready-to-merge from an unknown review signal; ready-to-merge from a cap-omitted item; a 4th catalog entry; a `status.collector.*` identity; exit `1` on unavailability; a `Date.now()` renderer; an unbounded/silent-drop renderer; a wide projection that leaks the canary; a model/network import; a store write; a spawned child; a product literal.
2. Assert each mutant fails the intended suite and that the failure message names the case.
3. Assert the clean production module passes the same suite (so the meta-check is not passing on a broken module).
4. Assert the mutant corpus covers every AC at least once; fail the meta-check when an AC has no mutant.
5. Assert the mutant corpus file count is non-zero and the runner never writes the live tree.

**Expected Outcome**:

- Every guard is proven load-bearing; a silently disabled guard fails the change.

#### TC-BRIEF-022 - Documented posture consistency with the shipped contract

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F6-2, DEC-2, GAP-T3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated (recorded content check + review)
**Target Layer / Location**: `doc/spec/features/feature-brief.md`, `doc/planning/oss-tooling/milestones/m1/commands/brief.md`, `doc/planning/oss-tooling/cli-command-registry.md`, `doc/spec/features/feature-status-digest.md`
**Tags**: @docs

**Preconditions**:

- The change authors a current-truth brief feature spec and reconciles the proposed man page.
- The testing strategy's content-check layer (§2) applies to documentation changes.

**Steps**:

1. Read the authored man page and current-truth brief spec; assert the declared exit status is `0` for collector unavailability and that no `status.collector.<id>.unavailable` identity is declared.
2. Assert the documented envelope example matches the shipped `CommandResult` shape (`schemaVersion`, `runId`, `exitCode`, `timing.totalMs`, `data`); record any illustrative-only fields as illustrative.
3. Assert the placeholder catalog in the docs is exactly the §4.3 three entries with owning stories (no spend, no fourth entry).
4. Assert the command registry row for `brief` reads delivered and names M1-S6; assert the status-digest spec cross-links the brief spec and that neither claims a contradictory posture.
5. Assert the review checklist records: "no LLM or model call in the brief render path" and "the ready-to-merge anchor is attention, never a merge verdict".
6. Record the commands used (e.g. `grep -n "collectors unavailable" ...`) and their output in §10.

**Expected Outcome**:

- Documentation, command registry, and code state the same contract; a reader cannot infer exit `2` on unavailability or find a rejected error identity.

**Notes / Clarifications**:

- This is deliberately semi-automated: a permanent suite asserting planning-doc prose would be brittle. The automatable half (error-table and exit-literal scans) is TC-BRIEF-013 and TC-BRIEF-012.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; no live provider, credential, or network | All brief suites are hermetic and in-process |
| CI (`ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; `pnpm build` before the test job; boundary and invariant jobs unchanged | Authoritative for suite results and the aggregate gate |
| In-process test process | Bun runtime; injected brand, clock, run id, streams, reader runtime, repository io, transport, state store | No child processes, no sockets |
| Temp fixture roots | `mkdtemp` under `$TMPDIR` | State store, PM-context file, mutants, whole-tree scans; removed per test |

### 6.2 Test Data and Fixtures (all synthetic)

| Fixture / artefact | Shape | Lifecycle |
|--------------------|-------|-----------|
| `tests/fixtures/brief/harness.ts` | `BriefCase`, `briefRuntime(facts, recorder)`, `runBriefCli(argv, runtime, options)`, cap-sized builders, and the shared digest+brief runner | Read-only code; per-test instances |
| `tests/fixtures/brief/cases.ts` | The shared-fact case model: one case per §4.7 control, per anchor edge, per cap boundary, and per verified-empty world; expectations are declared data | Read-only |
| `tests/fixtures/brief/corpus/<case>/case.json` | Per-surface expected state, reasons, counts, ordered action ids, placeholder entries, ages, truncation | Read-only; completeness meta-checked |
| `tests/fixtures/brief/golden/human.txt` | Byte-exact cap-sized human brief | Read-only; regenerated only by an explicit command |
| `tests/fixtures/brief/golden/envelope.json` | Byte-exact cap-sized `--json` envelope | Read-only; same rule |
| `tests/fixtures/brief/mutants/**` | One disabled guard per mutant, imported via `file://` in temp | Temp-copied only |
| `tests/fixtures/status/**` | Reused builders, corpus shape, matrix, negative controls, and golden helpers | Read-only; unchanged by this change |

**Fixture rules.** Refs are canonical `<PREFIX>-<digits>`; entity ids are synthetic; SHAs are 40-character synthetic hashes; timestamps are ISO-8601 UTC derived from `NOW_MS`; counts are small integers or documented maxima. No fixture contains a real path, title, credential, environment value, or provider payload. The single canary is fabricated and exists only to prove the redaction boundary.

### 6.3 Determinism Contract

- Time comes only from the injected `nowMs`/`nowIso`; `newRunId` is fixed; brand is `SYNTHETIC_BRAND`; the CLI tick clock returns constant values per invocation.
- Every iteration over surfaces, actions, placeholders, and recorded calls has an asserted order; no test depends on object key order or file enumeration.
- Replays reconstruct the runtime from the same facts and byte-compare stdout; goldens are committed and never rewritten by the suite.
- No sleep, timer, or retry-with-delay; no assertion compares against a moving base branch.

### 6.4 Isolation Strategy

- Temp roots are the only writable filesystem in the battery; the live tree, `dist/`, and the user's real state directory are never written.
- The reader runtime, repository io, transport, and state store are fakes with recorders; no live transport, credential, or socket exists.
- Fixtures are never named `*.test.ts`, so `bun test` discovery does not treat them as suites.
- Temp copies and temp roots are removed at test end; `git status --porcelain` is unchanged before and after the battery.

### 6.5 Entry and Exit Criteria for the Phase

**Entry (before execution)**

- The spec is accepted into the change; `.ai/rules/testing-strategy.md` and `.ai/rules/typescript.md` have been read.
- The brief contracts, projection, renderer, command, composition wiring, and inventory registration exist.
- The shared fact model, corpus, goldens, and mutants exist.

**Exit (before the change is proposed)**

- All 10 ACs have passing, traceable evidence recorded in §10 with commands and HEAD.
- Every one of the 22 TCs is green; every guard has its intentionally broken control (TC-BRIEF-021).
- Golden human and machine bytes are committed, in bounds, and unchanged after the suite.
- The error-table sync is green with zero new rows; the exit-literal invariant is green.
- `pnpm check`, `pnpm check:boundaries`, and `git diff --check` are green in a clean checkout.
- The manual posture check (TC-BRIEF-022) is recorded with its commands and output.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except TC-BRIEF-022, which is semi-automated with a recorded content check. File names below are the proposed suite names; the plan phase column is filled by `@plan-writer` from the delivering phases of `chg-GH-228-plan.md` v1.0.

| TC ID | Test file / artefact | Execution command | Control / mutation | Plan phase | Status |
|-------|----------------------|-------------------|--------------------|------------|--------|
| TC-BRIEF-001 | `tests/structure/brief-contract.test.ts` | `bun test tests/structure/brief-contract.test.ts`; `pnpm typecheck` | executable statement, 4th catalog entry, redeclared vocabulary, seeded product literal | Phase 1 | To Implement |
| TC-BRIEF-002 | `tests/behaviour/brief-command.test.ts` | `bun test tests/behaviour/brief-command.test.ts` | malformed invocation with zero-call assertion; valid sibling control | Phase 3 | To Implement |
| TC-BRIEF-003 | `tests/structure/brief-imports.test.ts`; `tests/boundaries` | `bun test tests/structure/brief-imports.test.ts tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `pnpm check:boundaries` | seeded `node:http`, seeded `fetch`, seeded model SDK, seeded new dependency | Phase 3 | To Implement |
| TC-BRIEF-004 | `tests/behaviour/brief-shared-truth.test.ts` | `bun test tests/behaviour/brief-shared-truth.test.ts` | fabricated-surface-state mutant; closed-set equality | Phase 2 | To Implement |
| TC-BRIEF-005 | `tests/behaviour/brief-read-cost.test.ts` | `bun test tests/behaviour/brief-read-cost.test.ts` | brief-only reader member; status baseline diff | Phase 3 | To Implement |
| TC-BRIEF-006 | `tests/behaviour/brief-output.test.ts` | `bun test tests/behaviour/brief-output.test.ts` | over-cap renderer; missing-marker; order-dropping renderer; at/over-cap pair | Phase 2 | To Implement |
| TC-BRIEF-007 | `tests/behaviour/brief-anchors.test.ts` | `bun test tests/behaviour/brief-anchors.test.ts` | unknown-review-as-approved mutant; cap-omitted vs in-cap pair | Phase 2 | To Implement |
| TC-BRIEF-008 | `tests/behaviour/brief-anchors.test.ts` | `bun test tests/behaviour/brief-anchors.test.ts` | unknown-age-as-zero mutant; future-timestamp case | Phase 2 | To Implement |
| TC-BRIEF-009 | `tests/behaviour/brief-placeholders.test.ts` | `bun test tests/behaviour/brief-placeholders.test.ts` | placeholder-as-observed mutant; 4th-entry mutant | Phase 2 | To Implement |
| TC-BRIEF-010 | `tests/behaviour/brief-negative-controls.test.ts` | `bun test tests/behaviour/brief-negative-controls.test.ts` | corrupted-expectation each fails by name; fully observed control | Phase 2 | To Implement |
| TC-BRIEF-011 | `tests/behaviour/brief-envelope.test.ts` | `bun test tests/behaviour/brief-envelope.test.ts` | exit-1-on-unavailability mutant; rejected identity scan | Phase 4 | To Implement |
| TC-BRIEF-012 | `tests/behaviour/brief-envelope.test.ts` | `bun test tests/behaviour/brief-envelope.test.ts`; `bun run scripts/checks/exit-code-literals.ts` | wrong-projection mutant; seeded exit literal | Phase 4 | To Implement |
| TC-BRIEF-013 | `tests/checks/error-table-sync.test.ts`; `tests/structure/error-table.test.ts` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | temp-copy row addition (both directions); `status.`-prefix scan | Phase 4 | Existing – Update |
| TC-BRIEF-014 | `tests/golden/brief.test.ts`; golden `human.txt` | `bun test tests/golden/brief.test.ts` | one-fact mutation + restore; mtime immutability | Phase 4 | To Implement |
| TC-BRIEF-015 | `tests/golden/brief.test.ts`; golden `envelope.json` | `bun test tests/golden/brief.test.ts` | one-fact mutation + restore; bound assertion | Phase 4 | To Implement |
| TC-BRIEF-016 | `tests/behaviour/brief-corpus.test.ts`; `tests/fixtures/brief/corpus/**` | `bun test tests/behaviour/brief-corpus.test.ts` | corrupted state/count/id/age/truncation fails by case | Phase 2 | To Implement |
| TC-BRIEF-017 | `tests/behaviour/brief-determinism.test.ts` | `bun test tests/behaviour/brief-determinism.test.ts` | `Date.now()` renderer; map-order renderer; permuted inputs | Phase 3 | To Implement |
| TC-BRIEF-018 | `tests/behaviour/brief-readonly.test.ts` | `bun test tests/behaviour/brief-readonly.test.ts` | write/spawn mutant; deliberate-fence control; anonymous instance | Phase 5 | To Implement |
| TC-BRIEF-019 | `tests/behaviour/brief-readonly.test.ts`; `tests/golden/redaction.test.ts` | `bun test tests/behaviour/brief-readonly.test.ts tests/golden/redaction.test.ts` | canary presence-then-absence; bypassing renderer | Phase 5 | To Implement |
| TC-BRIEF-020 | `tests/behaviour/brief-performance.test.ts` | `bun test tests/behaviour/brief-performance.test.ts` | non-vacuity count; page-size invariance | Phase 2 | To Implement |
| TC-BRIEF-021 | `tests/checks/brief-mutants.test.ts`; `tests/fixtures/brief/mutants/**` | `bun test tests/checks/brief-mutants.test.ts` | the mutant corpus itself; AC-coverage of mutants | Phase 5 | To Implement |
| TC-BRIEF-022 | `doc/spec/features/feature-brief.md`, man page, registry, status spec | recorded `grep`/read + review checklist | documented exit/identity/example/catalog assertions | Phase 8 | To Implement (manual half) |

### 7.1 Execution Order

The `Plan phase` column in §3.1 and §7 is authoritative; this sequence is phase-ascending so an incremental run follows the delivery plan. Within a phase, TCs are grouped by subject.

1. **Phase 1 — contract, catalog, bounds, inventory:** TC-BRIEF-001.
2. **Phase 2 — projection, anchors, placeholders, negative controls, corpus, performance:** TC-BRIEF-004, TC-BRIEF-006, TC-BRIEF-007, TC-BRIEF-008, TC-BRIEF-009, TC-BRIEF-010, TC-BRIEF-016, TC-BRIEF-020.
3. **Phase 3 — command surface, boundaries/purity/no-LLM, read cost, determinism:** TC-BRIEF-002, TC-BRIEF-003, TC-BRIEF-005, TC-BRIEF-017.
4. **Phase 4 — envelope, exits, error stability, goldens:** TC-BRIEF-011, TC-BRIEF-012, TC-BRIEF-013, TC-BRIEF-014, TC-BRIEF-015.
5. **Phase 5 — read-only posture, redaction, mutant corpus:** TC-BRIEF-018, TC-BRIEF-019, TC-BRIEF-021.
6. **Phase 8 — documented posture:** TC-BRIEF-022.
7. **Aggregate:** `pnpm check`.

### 7.2 CI Mapping

No new CI job is introduced. The existing jobs carry the new suites.

| Suite / check | Discovered by | CI job(s) |
|---------------|---------------|-----------|
| `tests/structure/brief-*.test.ts` | `bun test` | `ts-test`; boundary scans also in `ts-boundaries` |
| `tests/behaviour/brief-*.test.ts` | `bun test` | `ts-test` |
| `tests/golden/brief.test.ts` | `bun test` | `ts-test` |
| `tests/checks/brief-mutants.test.ts`, `error-table-sync.test.ts` | `bun test` | `ts-test` |
| `tests/boundaries/**` | `bun test tests/boundaries`; `pnpm check:boundaries` | `ts-boundaries` |
| `scripts/checks/{error-table-sync,exit-code-literals,ambient-globals,secret-read-boundary,forbidden-literals,privacy-literals,workspace-entrypoints}.ts` | direct invocation | `ts-invariants` / `ts-boundaries` |
| Aggregate | `pnpm check` | `ts-aggregate` and the individual `ts-*` jobs |

**Wiring rules.** The suites are discovered by the root `bun test` with no filter, no `--bail`, no `--passWithNoTests`, and no `|| true`; no job uses `continue-on-error`; no suite is skipped by `bunfig.toml`. No workflow file and no job is added. TC-BRIEF-022 is a recorded manual gate, not a CI job.

### 7.3 Evidence Commands

Run and record in §10 (never record an unrun result as passing):

```
pnpm install --frozen-lockfile
pnpm build
bun test tests/structure/brief-contract.test.ts
bun test tests/structure/brief-imports.test.ts
bun test tests/behaviour/brief-command.test.ts
bun test tests/behaviour/brief-shared-truth.test.ts
bun test tests/behaviour/brief-read-cost.test.ts
bun test tests/behaviour/brief-output.test.ts
bun test tests/behaviour/brief-anchors.test.ts
bun test tests/behaviour/brief-placeholders.test.ts
bun test tests/behaviour/brief-negative-controls.test.ts
bun test tests/behaviour/brief-envelope.test.ts
bun test tests/behaviour/brief-corpus.test.ts
bun test tests/behaviour/brief-determinism.test.ts
bun test tests/behaviour/brief-readonly.test.ts
bun test tests/behaviour/brief-performance.test.ts
bun test tests/golden/brief.test.ts
bun test tests/checks/brief-mutants.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/boundaries
bun test tests/behaviour/status-negative-controls.test.ts
bun test tests/behaviour/status-readonly-determinism.test.ts
bun test tests/golden/status-digest.test.ts
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/secret-read-boundary.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/privacy-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm typecheck
pnpm check
git diff --check
git status --porcelain
```

Manual half (TC-BRIEF-022):

```
grep -rn "collectors unavailable" doc/spec/features/feature-brief.md doc/planning/oss-tooling/milestones/m1/commands/brief.md
grep -rn "status.collector." doc/ packages/
grep -n "brief" doc/planning/oss-tooling/cli-command-registry.md
```

Notes:

- `pnpm build` is required because `pretest` builds and the boundary/export checks read `dist/`.
- `git status --porcelain` is captured before and after the battery; the suites must not modify the worktree.
- The status suites in the list are the explicit regression half; `pnpm check` runs them all anyway.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | The brief silently re-derives facts instead of projecting the digest's, so the two surfaces drift | H | M | The same-facts model, the §4.2 claim map, and the zero-extra-fact assertion; a fabricated-state mutant must fail (TC-BRIEF-004) |
| RSK-T2 | An unknown or unavailable review signal is rendered as approved, making the anchor a false green | H | M | §4.4 drives every forbidden fact; an unknown-as-approved mutant must fail (TC-BRIEF-007) |
| RSK-T3 | An owner-gate age is defaulted to zero or synthesized, hiding a long-stalled hand-back | H | L | §4.5 drives absent, unparseable, and future timestamps; an unknown-as-zero mutant must fail (TC-BRIEF-008) |
| RSK-T4 | An unbuilt capability renders as an empty observed surface, reading as "nothing to do" | H | M | The closed catalog, the named-line assertion, and the placeholder-as-observed mutant (TC-BRIEF-009, TC-BRIEF-021) |
| RSK-T5 | A collector failure is invisible on the brief | H | M | The §4.7 exhaustive matrix plus the bound surface set (§4.6); the fully observed control (TC-BRIEF-010) |
| RSK-T6 | The brief adopts the proposed exit-2/`status.collector.*` posture and drifts from status | H | L | DEC-2 pinned; exit-0 case plus a `status.`-prefix scan and a rejected-identity assertion (TC-BRIEF-011, TC-BRIEF-013) |
| RSK-T7 | A cap drops an approved pull request and the absence is read as "nothing to merge" | H | L | The cap-omitted case must render a truncation marker and claim nothing; the in-cap control proves the cause (TC-BRIEF-007, TC-BRIEF-006) |
| RSK-T8 | An LLM/network capability is imported into the render path in a later change | H | L | Import/AST scan with detectors, boundary fixture coverage, and no new dependency (TC-BRIEF-003) |
| RSK-T9 | Output exceeds the one-screen bound on dense worlds | M | L | At/above-cap fixtures, both byte bounds, explicit markers, and an over-cap mutant (TC-BRIEF-006) |
| RSK-T10 | A secret or raw payload leaks through evidence, a placeholder justification, or the human text | H | L | Planted canary asserted present first; single serialization path; a bypassing renderer must fail (TC-BRIEF-019) |
| RSK-T11 | A shared change (serializer, CLI edge, error table, status contract) regresses status | M | M | The unchanged status, error-table, result-contract, boundary, and inventory suites run as the regression half |
| RSK-T12 | The goldens are regenerated by the suite, silently blessing a regression | M | L | Read-only comparison plus `mtimeMs` immutability plus a mutation/restore control (TC-BRIEF-014, TC-BRIEF-015) |
| RSK-T13 | The placeholder catalog grows (e.g. a spend placeholder) without a reviewed change | M | L | Exact-catalog contract assertion, no-spend scan, and a 4th-entry mutant (TC-BRIEF-001, TC-BRIEF-009) |

### 8.2 Assumptions

- **A-T1 — Behaviour-bound TCs.** Proposed helper names, fixture file names, golden file names, surface ids, and exact human grammar are delivery-bound (OQ-1, GAP-T4). The semantics, state tokens, catalog, bounds, exits, identities, and AC mapping may not be rebound.
- **A-T2 — Same injected fact set.** Both commands consume `StatusFacts`; the brief is a second pure projection over the same builders, not a consumer of the serialized digest payload. This is the spec's own model (F-1, AC-F1-1 "rendered from those facts") and is what makes ages derivable at all (GAP-T1).
- **A-T3 — Ready-to-merge convention.** The predicate is the shipped queue-ready convention: observed `approved` review state, non-draft, open. `DeliveryRequestReviewState` is a single closed field in which `draft`, `open`, `approved`, `changes-requested`, `merged`, and `closed` are mutually exclusive, so "open, non-draft, approved" means `approved` plus `draft: false` plus not merged/closed.
- **A-T4 — Envelope shape.** The binding envelope is the shipped `CommandResult` (`schemaVersion` = `delivery.result.v1`, `runId`, `exitCode`, `timing.totalMs`, and exactly one of `data`/`error`). The proposed man-page example fields are illustrative.
- **A-T5 — Bounds semantics.** Human lines are counted as non-empty lines; human size is `Buffer.byteLength(..., "utf8")`; the machine bound applies to `JSON.stringify(envelope.data)` as UTF-8 bytes, matching the shipped status bound.
- **A-T6 — Exponential is not required.** The corpus is a coverage obligation, not a combinatorial product: one case per matrix cell, per anchor edge, and per cap boundary.
- **A-T7 — Regression half is unchanged.** The existing status and structure suites are extended only where the change genuinely touches them (`error-table-sync`, `inventory.json`); no existing assertion is weakened.
- **A-T8 — Plan-relative.** `chg-GH-228-plan.md` does not exist at this revision. Any plan phase that changes a TC's behaviour, oracle, or AC mapping must reopen this plan.

### 8.3 Open Questions and Recorded Gaps

| ID | Question / gap | Context | Status | Owner |
|----|----------------|---------|--------|-------|
| OQ-T1 | What is the exact human line grammar and per-surface wording? | Spec OQ-1 leaves it to delivery; the plan pins bounds, order, state tokens, and marker presence only | Open — non-blocking; pinned by the committed goldens (TC-BRIEF-014) | @coder / @plan-writer |
| OQ-T2 | What are the internal module, export, fixture, and golden file names? | Delivery-bound (GAP-T4); semantics are pinned | Open — non-blocking | @plan-writer / @coder |
| OQ-T3 | Does the ready-to-merge evidence cite `deliveryState` only, or also the item-level review-signal token? | §4.4 binds "reproduce the item's `deliveryState`, `draft`, and review-signal state"; the exact evidence string is delivery-bound | Open — non-blocking | @coder |
| OQ-T4 | Should a future `updatedAt` be `unknown` or clamped to `0`? | §4.5 forbids a negative age and forbids fabrication; it accepts either `unknown` or a non-negative value | Open — non-blocking | @coder |
| OQ-T5 | Should the corpus completeness meta-check import the digest matrix directly instead of restating expectations? | Importing couples the brief test to status internals; restating risks drift. The plan prefers a parity assertion (brief case × digest matrix) | Open — non-blocking | @plan-writer |
| GAP-T1 | AC-F1-1's "ages equal the digest's claim" has no digest-side claim for owner hand-backs | The digest exposes `ageDays` only on stalls and parked work. Spec v1.1 made AC-F1-1 two-branch and named the rule as the source; §4.2/§4.5 implement it | **Resolved in spec v1.1** — no further action | @spec-writer |
| GAP-T2 | The brief surface set was not enumerated in the spec | Spec v1.1 added DM-5: nine ids (six digest sections + three placeholders), anchors as action groups | **Resolved in spec v1.1** — §4.6 restates DM-5 | @spec-writer |
| GAP-T3 | "Named placeholders" on unavailability versus the closed DEC-6 catalog | Spec v1.1 F-5/DEC-2 say the affected surface names its own evidence state, distinct from the catalog | **Resolved in spec v1.1** — §4.3/§4.8 already bind it | @spec-writer |
| GAP-T4 | Delivery-bound spellings | Pinned semantics; unpinned names | Recorded — non-blocking | @coder |
| GAP-T5 | NFR-3, NFR-4, NFR-8 have no dedicated AC | Mapped to AC-F1-1 and the existing literal/inventory gates in §3.3 | Recorded — non-blocking | @spec-writer |

**Gap summary for the readiness gate.** No AC is untestable, and no gap remains open at this revision: spec v1.1 closed the age-comparison wording (GAP-T1), pinned the nine-id render-surface set in DM-5 (GAP-T2), and disambiguated collector-unavailability rendering against the closed DEC-6 catalog (GAP-T3). This plan's §4.2, §4.5, §4.6, §4.3, and §4.8 now restate the spec rather than a local binding.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-05T00:00:00Z | Change Test Plan Writer | Initial plan: 22 TCs (`TC-BRIEF-001..022`, a new prefix). All 10 ACs and all 8 NFRs mapped with no orphan TCs. Binds the same-facts shared-truth model and claim map (§4.2), the closed placeholder catalog (§4.3), the ready-to-merge predicate (§4.4), the owner-gate age oracle (§4.5), the bound surface set (§4.6), the exhaustive failed/absent-read matrix (§4.7), the envelope/exit oracle (§4.8), the non-vacuity contract (§4.10), and the golden/corpus/mutant fixture strategy. Records three spec wording gaps (GAP-T1..T3) and the delivery-bound-spelling assumption (GAP-T4). Authored against spec v1.0; no spec, plan, pm-notes, or code file was modified. |
| 1.1 | 2026-11-06T00:00:00Z | plan-writer | Filled the reserved "Plan phase" columns (§3.1 and §7) with the delivering phase ids from `chg-GH-228-plan.md` v1.0 (Phases 1–5 build the command and battery; Phase 8 is the @doc-syncer documentation phase delivering TC-BRIEF-022). No TC, oracle, suite target, control, or AC mapping changed; A-T8 bookkeeping only. |
| 1.2 | 2026-11-06T12:00:00Z | Change Test Plan Writer | DoR iteration-1 test-plan touch-ups (F-2, F-3, F-6; spec v1.1 alignment). (1) F-2 reverse traceability: added TC-BRIEF-002 to the AC-F1-1 row and TC-BRIEF-016 to the AC-F6-1 row in §3.1, so the matrix matches the §5.1 Related IDs; forward coverage was already complete. (2) F-3 cross-artifact consistency: rewrote §4.6 as "Closed Render-Surface Set" per spec DM-5 and plan D2/D4 — exactly nine surface ids (six digest-section ids + `typed-questions`, `gate-sla-states`, `lane-queue-engine`), with ready-to-merge and owner-gate ages described as ranked DM-2 anchored-action groups, the blocker-questions block as the `typed-questions` placeholder surface, and `gate-sla-states` beside the owner-gate ages block; the fixed correspondence list is unchanged. (3) F-6: reordered §7.1 phase-ascending (Phase 1 → 2 → 3 → 4 → 5 → 8 → aggregate), named the phases, and stated that the §3.1/§7 `Plan phase` column is authoritative; all 22 TCs retained exactly once. (4) Consequential staleness only: marked GAP-T1, GAP-T2, and GAP-T3 resolved by spec v1.1 in §1.2, §3.4, and §8.3, because the spec now pins the two-branch age rule, DM-5, and the unavailability-rendering distinction; no oracle, assertion, or mapping changed. F-4 (placeholder render position) intentionally untouched — absorbed by the OQ-1 Phase-4 goldens. 22 TCs, 10 ACs, 8 NFRs, all suite targets, controls, and AC mappings unchanged. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Phase 1 — TC-BRIEF-001 (contracts, catalog, bounds by reference, inventory) | 2026-11-06 | PASS | `bun test tests/structure/brief-contract.test.ts`: 8 pass, 0 fail. HEAD `4243506c`. |
| Phase 2 — TC-BRIEF-004/006/007/008/009/010/016/020 (projection, anchors, placeholders, controls, corpus, performance) | 2026-11-06 | PASS | `bun test tests/behaviour/brief-{shared-truth,anchors,placeholders,negative-controls,output,corpus,performance}.test.ts`: 210 pass, 0 fail. HEAD `ea86d819`. |
| Phase 3 — TC-BRIEF-002/003/005/017 (command, imports, read cost, determinism) | 2026-11-06 | PASS | `bun test tests/behaviour/brief-{command,read-cost,determinism}.test.ts tests/structure/brief-imports.test.ts`: 23 pass, 0 fail. HEAD `5b45791c`. |
| Phase 4 — TC-BRIEF-011/012/013/014/015 (envelope, exits, error table, goldens) | 2026-11-06 | PASS | `bun test tests/behaviour/brief-envelope.test.ts tests/golden/brief.test.ts tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts`: 108 pass, 0 fail. HEAD `4e6d697a`. |
| Phase 5 — TC-BRIEF-018/019/021 (read-only, redaction, mutants) | 2026-11-06 | PASS | `bun test tests/behaviour/brief-readonly.test.ts tests/golden/redaction.test.ts tests/checks/brief-mutants.test.ts`: 43 pass, 0 fail. HEAD `ed916459`. |
| All brief suites | 2026-11-06 | PASS | `bun test tests/structure/brief tests/behaviour/brief tests/golden/brief.test.ts tests/checks/brief-mutants.test.ts`: 282 pass, 0 fail, 16 files, 4231 expect calls. |
| TC-BRIEF-004 — shared truth | 2026-11-06 | PASS | 140 case/surface assertions across 35 shared-fact cases (12 named cases + 23 matrix controls); surface-id and placeholder-set equality are non-vacuous. |
| TC-BRIEF-007 — cap-omitted approved PR | 2026-11-06 | PASS | The in-cap control (`approved(8)`) produces the action set; `approved(9)` produces 8 actions, no identity `508`, and a truncation marker. |
| TC-BRIEF-010 — negative-control matrix | 2026-11-06 | PASS | All 23 `matrixCases` rows mapped; the fully observed control renders tracker/changes/ci/providers/parked as `observed`; at-limit marker present, near-limit absent. |
| TC-BRIEF-014/015 — goldens | 2026-11-06 | PASS | Byte equality for `human.txt` and `envelope.json`; cap-sized human 11 lines / 564 bytes (the committed file's size; corrects the earlier 641-byte transcription); machine `data` 4791 bytes; mutation/restore control and unchanged `mtimeMs` pass. |
| TC-BRIEF-019 — redaction canary | 2026-11-06 | PASS | The canary is asserted present in the planted fixture before zero occurrences in stdout/stderr; the `writeOutput` chokepoint redacts human text. |
| TC-BRIEF-021 — mutant corpus | 2026-11-06 | PASS | 20 mutants cover all 10 ACs; the clean payload resists every mutant and each mutant produces its prohibited observable naming its case. |
| TC-BRIEF-022 — documented posture | 2026-11-06 | PASS | Authored `doc/spec/features/feature-brief.md` (SPEC-BRIEF); reconciled `doc/planning/oss-tooling/milestones/m1/commands/brief.md`; registry row reads delivered and names M1-S6; status-digest spec and brief spec cross-link both ways. Commands, output, and the review checklist are recorded in §10.1. |
| Aggregate `pnpm check` | 2026-11-06 | PASS | `TMPDIR=$PWD/tmp/tmpdir pnpm check`: 2961 pass, 4 skip, 0 fail, 274 files, 30225 expect calls (315.81 s); boundaries 161 modules / 372 deps; ambient, workspace-entrypoints, secret-read and exports-parity all green. |
| `git diff --check` | 2026-11-06 | PASS | Clean (no whitespace or conflict markers) before and after the battery. |

### 10.1 TC-BRIEF-022 evidence (documented posture)

Executed 2026-11-06 at branch `feat/GH-228/brief-render-only`, HEAD `b45e4dca`, after authoring and reconciling the current-truth documentation.

**Step 1–2 — exit posture and rejected identity.**

```
$ grep -rn "collectors unavailable" doc/spec/features/feature-brief.md doc/planning/oss-tooling/milestones/m1/commands/brief.md
(no output; exit 1)

$ grep -rn "status\.collector\." doc/spec/features/feature-brief.md doc/planning/oss-tooling/milestones/m1/commands/brief.md
doc/spec/features/feature-brief.md:137: ... No `status.collector.<id>.unavailable` identity exists in the error table, the payload, the evidence, or the documentation.
doc/spec/features/feature-brief.md:262: | DEC-2 | ... no `status.collector.<id>.unavailable` identity and no error-table row exist. |
doc/planning/oss-tooling/milestones/m1/commands/brief.md:130: command. There is no `status.collector.<id>.unavailable` identity, and
```

All three hits are negating statements; no brief document declares the identity or an exit-2 "collectors unavailable" outcome. The man page's EXIT STATUS section reads `0` rendered (including every collector failure), `1` rejected invocation, `2` containment/internal failure. The envelope example carries `"schemaVersion": "delivery.result.v1"`, `"runId"`, `"exitCode": 0`, `"timing": { "totalMs": 10 }`, and `"data"`; the illustrative-only fields (`runId`, `timing`, `generatedAt`, binding values, counts) are marked illustrative in the example lead-in.

**Step 3 — closed placeholder catalog.**

```
$ grep -n '^| `typed-questions`\|^| `gate-sla-states`\|^| `lane-queue-engine`' doc/spec/features/feature-brief.md
91:| `typed-questions` | M1-S16 | `not-delivered` | The typed blocker/question channel does not exist in v0; the blocker-question surface is a named placeholder |
92:| `gate-sla-states` | M1-S5 | `not-delivered` | Ages render; SLA classifications do not exist until owner-gate SLA mechanics land |
93:| `lane-queue-engine` | M1-S17 | `not-delivered` | No queue or lane engine exists; the digest's `lanes-or-queue` section is always `not-delivered` |

$ grep -n "spend" doc/spec/features/feature-brief.md
95:The catalog is exactly three entries, contains no spend entry, and grows only through a reviewed change ...
265:| DEC-5 | ... spend is not surfaced. |
```

Exactly three catalog rows, all `not-delivered` with their owning stories; both `spend` hits are negations (no spend entry, spend not surfaced), so no spend placeholder or anchor exists.

**Step 4 — registry and cross-links.**

```
$ grep -n "M1-S6 (delivered in GH-228)" doc/planning/oss-tooling/cli-command-registry.md
170:| `ados brief` | Delivered in GH-228 (M1-S6): ... | operator | M1-S6 (delivered in GH-228) | - |

$ grep -c "feature-brief.md" doc/spec/features/feature-status-digest.md
4
$ grep -c "feature-status-digest.md" doc/spec/features/feature-brief.md
3
```

The status-digest spec cross-links the brief spec in its overview, command-surface hook sentence, dependency list, and See-also line; the brief spec cross-links the status digest in its overview, dependencies, and See-also line. Neither spec claims a contradictory ready-to-merge or exit posture.

**Step 5 — review checklist items.**

- [x] **No LLM or model call in the brief render path.** `grep -rniE 'openai|anthropic|langchain|ollama|node:http|node:https|node:net|node:dns|undici|child_process|fetch\(' packages/core/src/contracts/brief.ts packages/core/src/domain/brief.ts packages/cli/src/commands/brief.ts` returns no matches (exit 1, non-empty file set). TC-BRIEF-003's import/AST scan and the `ts-boundaries` rules are the mechanical half.
- [x] **The ready-to-merge anchor is attention, never a merge verdict.** `BriefAction` carries `identity`, `state`, and citing `evidence` (`kind`, `deliveryState`, `draft`, `reviewState`) only; there is no verdict, authorization, or "safe to merge" field. The brief spec, the man page, and the registry row all state attention-only, and merge/gate authority remains with `verify gates` and the merge transaction.

**Step 6 — guards.**

```
$ bun run scripts/checks/error-table-sync.ts
error-table-sync: entries=52 documented=52 S1=103 S3=16 corpus=18 ignored=136
OK error-table-sync: source, documented table, and fixtures agree

$ bash scripts/.tests/test-doc-distribution.sh
(guard-doc-distribution)[OK]   get_marker() self-tests passed (7 .md + 4 .yaml cases)
(guard-doc-distribution)[OK]   no drift — 81 in-scope docs; install set matches ados_distribution markers
```

No error-table row, domain kind, or configuration key was added by this change; the new feature spec and the touched status-digest spec keep `ados_distribution: internal`, and no new distributable doc was added.
