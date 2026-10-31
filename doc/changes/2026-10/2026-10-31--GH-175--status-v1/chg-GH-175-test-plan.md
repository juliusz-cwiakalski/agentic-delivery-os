---
id: chg-GH-175-test-plan
status: Updated
created: 2026-10-31T14:30:00Z
last_updated: 2026-10-31T18:30:00Z
owners: [engineering]
service: delivery-os CLI status digest
labels: [change, planning]
version_impact: minor
summary: "Status M0-S6: a read-only `ados status` that returns exactly six fixed sections (tracker, changes-and-prs, ci, lanes-or-queue, providers, parked-work), each with one closed five-value state, bounded evidence, counts, ranked items, and a truncation marker, plus a full `delivery.status.v1` machine envelope and a deterministic human digest. The plan proves section totality and the Appendix A derivation matrix; tracker four-family evidence over normalized WorkItem data (labels-only owner hand-backs, unavailable GitHub blocked dependencies, updatedAt-absent stalls as unknown, title/label hygiene only); changes/PRs with unknown review signals; CI result classification where none is never green; lanes always not-delivered; providers from config plus verified park fold with unverified-not-available entries and zero engine/quota calls; parked work from git-ignored PM context with truthful absence/malformed/empty; origin-derived repository binding without credentials; bounded GitHub collection reads with unchanged capability and extended trap coverage; the exhaustive AC-F9-1 negative-control matrix; zero writes/fences/mutations/network-writes/child-processes; byte-identical replay; no new error row, config key, state schema, package, subpath, runtime-API location, or secret-read allowlist entry; and a fixture-driven default suite plus an opt-in structural live smoke."
links:
  change_spec: ./chg-GH-175-spec.md
  implementation_plan: ./chg-GH-175-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S6: status v1

## 1. Scope and Objectives

This change introduces the one read-only first-call digest that replaces the coordinator's manual per-session probing of tracker, pull requests, CI, lanes, providers, and parked work. The tests must prove three things at once: **the digest is total and bounded** (exactly six sections in fixed order, one state from a closed five-value vocabulary, non-empty evidence, uniform counts, ranked capped items, and an explicit truncation marker on every section, with a short deterministic human line per section), **truthfulness is structural, not prose** (no failed, absent, unattempted, unresolved, credential-denied, config-invalid, or state-unreadable read may become `observed` with zero items or a clear/green/available claim; a provider entry without park evidence is `unverified`, never `available`; CI `none` is never `succeeded`; the queue section is `not-delivered`, never an empty queue), and **the read-only/tier contract holds** (zero writes, fences, state mutations, network writes, and child processes; injected clock and reads only; identical inputs yield byte-identical digests and human text; no new error row, config key, state schema, package, subpath, runtime-API location, or secret-read allowlist entry).

The plan is built around three adversarial mechanisms the specification names. First, the **Appendix A state derivation matrix is executed cell by cell**, including the item-level-unknown cases that are distinct from an unobserved section. Second, the **AC-F9-1 negative-control matrix is exhaustive and non-vacuous**: every failed/absent/unresolved/credential/state/park control asserts the exact section or item state, the reason, the absence of an observed-zero/clear/green/available claim, and a restored control that reaches `observed`. Third, **bounds are measured, not asserted by sampling**: cap-sized and over-cap fixtures, a 100-item issues page, a 20-run check-runs page returned by one `per_page=STATUS_SOURCE_PIPELINE_LIMIT` request, the 64 KiB machine bound, and the 24-line/4096-byte human bound all have an over-limit control that must fail.

### 1.1 In Scope

- The `status` command surface: exact command name, no positionals, no command-specific flags, global `--json`; parser rejection with `fallback.invocation` and exit `1` before any source read; handler with no stream writes and no exit choice (F-1, AC-F1-1).
- Six-section totality in the fixed order `tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`, `providers`, `parked-work`; the five-value state vocabulary; evidence, counts, ranked items, and `truncated` on every section (F-2, DM-1, DM-2, DM-3, AC-F2-1, NFR-1).
- The Appendix A section-state derivation matrix across `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`, including item-level unknown signals inside an `observed` section (F-2, F-9, DM-3, AC-F2-2, NFR-3).
- Tracker four families over normalized `WorkItem` data: owner hand-backs by declared owner-attention labels (absent `assignee` is not unassigned), blocked dependencies (declared unavailable on the minimal GitHub slice; Jira-shaped observed/open/done/canceled/unobserved targets), stalls over injected-clock `updatedAt` (older, fresh, absent, invalid), and hygiene (`missing-title`, `missing-labels`; no comment or unmapped custom-field conformance) (F-3, DM-5, DM-14, AC-F3-1..AC-F3-4).
- Changes and PRs: local active change observed/observed-empty/unknown (missing or malformed PM context is unknown, never none), open PR list with refs/draft/state, review state/threads `unknown` when the source declares them unavailable, and partial failure as `degraded` (F-4, DM-6, DM-14, AC-F4-1).
- CI: one bounded check-runs page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), no pagination, with the raw page size driving the at-limit signal; result classification `failed`/`pending`/`succeeded`/`canceled`/`none`, all-skipped never `succeeded`, no-run `none` never green, unresolved SHA and failed read as `unknown` with reason and failure class (F-5, F-10, DM-7, DM-12, AC-F5-1, AC-F10-1).
- Lanes-or-queue: always `not-delivered` with `engine-not-delivered`, source `queue-engine`, zero items/counts, the `M2-S1` expected story, and no duplication of `queue ready` (F-6, DM-8, AC-F6-1).
- Providers: declared chain/entries from the resolved provider configuration plus active parks from the verified read-only park fold; entry availability `parked` or `unverified` (never `available`); chain park; no default chain `unavailable`; park read failure `degraded` with a state code and no "no parks" claim; zero provider-engine `resolve`/`quota`, quota fetch, announcement write, or state mutation (F-7, DM-9, AC-F7-1, AC-F7-2).
- Parked work: `parked_changes` from the git-ignored local PM context; observed items, explicit-empty `observed-empty`, absent `unavailable`/`local-context-missing`, malformed or non-array `unknown`/`local-context-malformed`, item-level unknown for an entry without `workItemRef`, optional age only from a present parseable `parkedAt`, and no free-form `notes` projection (F-8, DM-10, AC-F8-1).
- Repository binding: `origin` HTTPS/SSH forms to `{ host: "github.com", owner, name, remoteName: "origin" }`, userinfo/credentials stripped, absent/unparseable/non-GitHub as unavailable, and truthful propagation to tracker/changes/CI with `addressing-unresolved`/`remote-unsupported`; no new config key and no alternate remote (F-12, DM-11, AC-F12-1).
- Bounded GitHub reads `listWorkItems` (issues with PR objects filtered) and `listDeliveryRequests` (open PRs), one bounded page each under the unchanged closed operation set and capability declaration; the existing `readPipelineRun` keeps its name and gains a declared page limit at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` with raw-page-size reporting and no pagination; the extended four-field GitHub trap catalog and its bidirectional coverage (F-5, F-10, F-13, DM-12, DM-14, AC-F5-1, AC-F10-1, AC-F13-1, NFR-7, NFR-8).
- Evidence and non-verdict degradation: the exhaustive AC-F9-1 matrix and the closed reason/source/outcome vocabularies (F-9, DM-4, AC-F9-1).
- Bounds: section/family/source/item caps, `counts.omitted`, `truncated` (dropped or source-at-limit), `source-truncated` evidence, and deterministic ordering independent of API/map order (F-10, DM-12, AC-F10-1, NFR-2).
- Machine output: exactly one valid `CommandResult` envelope, `data.schemaVersion: "delivery.status.v1"`, `generatedAt`, `repository`, `summary`, six sections, ≤64 KiB (F-11, DM-1, DM-13, AC-F11-1, NFR-2, NFR-5).
- Human output: optional header plus exactly one line per section in fixed order, ≤24 lines and ≤4096 bytes, state and bounded counts on every line, no item titles, no secrets, no LLM prose, zero extra reads, rendered from the same digest as `--json` (F-11, DM-13, AC-F11-2, NFR-2, NFR-5).
- Read-only, deterministic, tier/brand-neutral execution and the boundary/ambient/forbidden-literal/secret-read/entrypoint gates; no new runtime-API location, package, or subpath (F-14, AC-F1-2, AC-F14-1, NFR-4, NFR-7, NFR-10).
- Error-identity reuse: no new error-table row/domain kind; section evidence uses existing `config.*`/`state.*` codes or adapter-local classes that are not error-table identities; only `fallback.invocation`/`fallback.internal` can fail the command (F-15, AC-F15-1, NFR-8).
- Real-corpus and live evidence: a committed fixture corpus for every section, state edge, cap, ordering rule, and negative control with zero live calls; an opt-in `ADOS_STATUS_LIVE=1` credentialed structural live smoke outside default CI (F-16, AC-F16-1, NFR-6, NFR-9).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any queue, lane, dispatch, supervision, board, brief, merge, deploy, closeout, or `queue ready` engine/command. Lanes-or-queue is asserted as a declared `not-delivered` gap; it is not exercised as an empty queue and not duplicated (NG-1, DEC-11).
- [OUT] Provider-engine execution, chain resolution, quota evaluation/fetch, announcements, park writes/clears, telemetry, spawn/model selection. Status is tested only as a config/park reader (NG-2, DEC-12).
- [OUT] Any mutation: no state append/fence/park clear/projection rebuild, no pm-notes or PM-context write, no tracker/PR/CI write (NG-3).
- [OUT] New typed configuration keys or branches for tracker, VCS, CI, or repository addressing; Jira instance binding in the status composition (NG-4, NG-5, OQ-1).
- [OUT] Full GitHub adapter, GraphQL review decisions/threads, structured issue-dependency reads, push parity, open-PR-head CI, merge-gate evaluation (NG-6, OQ-3, OQ-5).
- [OUT] LLM summarization/semantic ranking/recommendations/prose, cross-repository/fleet status, MCP/OpenCode surfaces, agent prompt adoption, pm-notes ledger reads, and `verify change` duplication (NG-7, NG-8, NG-10).
- [OUT] New error-table rows/identities, envelope changes, state-schema changes, new packages/subpaths/runtime-API locations, or new secret-read allowlist entries (NG-9, DEC-15).
- [GAP-1 — implementation-plan mapping — RESOLVED by the current implementation plan (v1.1 onward; currently v1.3) (`chg-GH-175-plan.md`)] The implementation plan now exists and maps every TC to a delivery phase/task; it must not reshape these TCs. This plan binds behaviour, states, reasons, bounds, assertions, and AC/NFR mapping. If a later plan or implementation changes a pinned contract, this test plan reopens.
- [GAP-2 — tracker cap interaction — RESOLVED by spec v1.3 (DM-5, DM-12, Appendix C, Appendix D)] Appendix C declares both `STATUS_MAX_ITEMS_PER_SECTION = 8` and `STATUS_MAX_TRACKER_FAMILY_ITEMS = 4`, while DM-5 gives each tracker family its own capped `items` and DM-2 allows a common `items` list *or* section-specific family/item fields. Spec v1.3 states that each tracker family caps independently at 4; the tracker section has no common `items` list; `truncated` is true when any family dropped items; `counts.omitted` is the sum across families; and no tracker family list exceeds 4. §8.3 OQ-T1 is resolved; the tests assert per-family 4 and would also fail an implementation that emits a single tracker list longer than 8.
- [GAP-3 — non-tracker rank keys not enumerated — RESOLVED by spec v1.3 (§8.3 rank-key table, DM-12, Appendix D)] Appendix D pins the tracker rank keys only. DM-12 requires "deterministic rank keys" and F-10 requires order independence; spec v1.3 enumerates the rank keys and tie-breakers for PRs, CI runs, provider entries/parks, and parked work. This plan tests **permutation invariance** (reversed API/map order yields identical item order) and the pinned §8.3 key for each section. §8.3 OQ-T2 is resolved. No AC is weakened: order independence is still asserted.
- [GAP-4 — providers state precedence — RESOLVED by spec v1.3 (DM-9, Appendix A, §8.3)] Appendix A gives `providers` rows for `unknown` (config read failed/invalid/unresolved), `unavailable` (no declared default chain), and `degraded` (config/entries observed but park fold failed); spec v1.3 fixes the precedence `unknown` (config untrusted) → `unavailable` (no default chain) → `degraded` (park fold failed) → `observed` as canonical. This plan tests the clear cells and the previously ambiguous combination; §8.3 OQ-T3 is resolved.
- [GAP-5 — `summary.actionable` semantic — RESOLVED by spec v1.3 (DM-1, Appendix B)] DM-1 defines `actionable` as "the number of listed items in observed/degraded sections"; spec v1.3 fixes the definition: `actionable` = the sum of rendered `items` arrays in sections whose state is `observed` or `degraded`, counting tracker family items individually, PR items, CI runs, provider entries, provider parks, and parked items, and excluding `unknown`/`unavailable`/`not-delivered` sections. §8.3 OQ-T4 is resolved.
- [GAP-6 — live-smoke env literal vs brand neutrality — RESOLVED by spec v1.3 (F-16, Appendix G, AC-F16-1)] Appendix G names the switch `ADOS_STATUS_LIVE=1`, but the forbidden-literal scanner scans `packages/**` and registered `doc/**` for `ados`/`ADOS_`/`~/.ados`. Spec v1.3 fixes the harness under `tests/**` (test-only literal allowed) and requires the production edge to derive any live-smoke switch from `brand.environmentPrefix`; §8.3 OQ-T5 is resolved.
- [GAP-7 — machine bound unit — RESOLVED by spec v1.3 (AC-F11-1, NFR-2, Appendix C)] AC-F11-1 says "the payload is at most 64 KiB"; NFR-2 says "machine digest size ≤ 64 KiB". Spec v1.3 fixes the unit: the serialized `data` (the digest) is ≤ 65 536 bytes and the envelope total is recorded separately without a second hard cap; §8.3 OQ-T6 is resolved.
- [GAP-8 — delivery-bound spellings] Contract export names, runtime type names, helper names, section `title` strings, human line labels, and the exact human header wording are delivery-bound. The section ids, order, states, reasons, sources, outcomes, counts, caps, and schema version are pinned here and may not be rebound.
- [GAP-9 — source-at-limit with filtered PRs — RESOLVED by spec v1.3 (F-10, DM-12, Appendix F, AC-F10-1)] The "source returned exactly the read limit" truncation signal is defined on the raw page. A 100-issue page that contains PR objects yields fewer than 100 `WorkItem`s after filtering while still signalling "more may exist". Spec v1.3 makes the raw-page derivation canonical for both the list reads (raw page vs `STATUS_SOURCE_ITEM_LIMIT`) and the check-runs read (raw page vs `STATUS_SOURCE_PIPELINE_LIMIT`); this plan asserts the signal derives from the raw page size and records both nuances in TC-STATUS-007; §8.3 OQ-T7 is resolved.

## 2. References

- **Change specification**: [chg-GH-175-spec.md](./chg-GH-175-spec.md) — F-1..F-16, AC-F1-1..AC-F16-1 (24), NFR-1..NFR-10, DM-1..DM-15, RSK-1..RSK-12, DEC-1..DEC-17, OQ-1..OQ-7, Appendix A (state matrix), Appendix C (constants), Appendix D (tracker predicates/ranks), Appendix E (human grammar), Appendix F (GitHub reads/traps), Appendix G (live smoke).
- **Decision records**: the change spec's §15 is the normative decision log for this change: DEC-6 (query-shaped collection reads under the existing operation set), DEC-8 (declared signal availability), DEC-12 (config/park reads, no engine), DEC-14 (caps/ranks/truncation), DEC-15 (no new error identity). The repository decision index is [doc/decisions/README.md](../../../decisions/README.md).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, runtime-API confinement, no ambient reads.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope shape, documented error table, classification chain, `{0,1,2}` projection, sole redaction path, bidirectional sync.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — verified reads, torn/schema evidence, verified-empty, provider park/announcement records, `provider-parks.json` fold, no write on read.
- **Provider client seeds**: [feature-provider-client-seeds.md](../../../spec/features/feature-provider-client-seeds.md) — `WorkItem`/`DeliveryRequest`/`PipelineRun`, GitHub read slice, trap-catalog four-field shape and bidirectional coverage, `GITHUB_ADAPTER_CONTRACT`.
- **Provider engine**: [feature-provider-engine.md](../../../spec/features/feature-provider-engine.md) — provider vocabulary, parks, expiry, the read-only `parks list` surface, no engine call from status.
- **Configuration layer**: [feature-config-layer.md](../../../spec/features/feature-config-layer.md) — typed `provider` branch, `provider.defaultChain` absent and `provider.chains` empty by default.
- **Architecture**: [ADR-0003 — OSS Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — package tiers, runtime-API allowlist; [ADR-0004 — WorkItem activity timestamp additive v1](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) and [ADR-0006 — WorkItem custom fields and comment omission representation](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — absence semantics for `updatedAt` and comments.
- **Command registry**: `doc/planning/oss-tooling/cli-command-registry.md` — the `status` row (`M0-S6`) and the `queue ready` (`M0-S7`) non-duplication boundary.
- **Existing mechanisms**: `tests/behaviour/verify-support.ts` (`guardStore` mutation recorder); `tests/fixtures/state/harness.ts` (temp store, injected edge, fold helpers); `tests/behaviour/providers/trap-harness.ts` (catalog load/schema/bidirectional coverage/replay); `tests/behaviour/providers/support.ts` (`createFixtureTransport`, `installThrowingFetchGuard`); `tests/golden/helpers.ts` (`runCli`, synthetic brand, fixed run id/clock); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/structure/{content-inventory,subpaths,trap-catalog,error-table,cli-edge-seam,provider-surface}.test.ts`; `tests/structure/inventory.json`; `tests/checks/{error-table-sync,secret-read-boundary,forbidden-literals}.test.ts`; `tests/boundaries/**`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`.
- **Ticket**: GH-175 — M0-S6: status v1.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | `status` with no positionals/flags returns one success digest; an extra positional or unknown flag is `fallback.invocation`, exit `1`, no read; `--json` is the only switch | TC-STATUS-001 | Covered |
| AC-F1-2 | Zero writes, fences, state mutations, network writes, child processes; read-only reads; identical injected inputs replay byte-identically | TC-STATUS-024, TC-STATUS-025 | Covered |
| AC-F1-3 | Non-observed sections (including a reachable run with no `observed` section) still return a success envelope with all six sections and exit `0`; only parser/invocation or internal containment error | TC-STATUS-002 | Covered |
| AC-F2-1 | Exactly six sections in fixed order; one five-value state; non-empty evidence, counts, ranked items, truncation; no missing/extra | TC-STATUS-003, TC-STATUS-008 | Covered |
| AC-F2-2 | Appendix A state derivation matches every cell; item-level unknowns do not become a clear/zero claim | TC-STATUS-004 | Covered |
| AC-F3-1 | Owner hand-backs from `hand-back`/`human-input-needed` labels; absent `assignee` not unassigned; deterministic/bounded | TC-STATUS-009 | Covered |
| AC-F3-2 | GitHub blocked dependency family `unavailable`/`signal-unavailable`, never observed-empty; Jira-shaped open/done/canceled/unobserved target semantics | TC-STATUS-010 | Covered |
| AC-F3-3 | Stalls: older than 14 days stalled with age; fresh not listed; absent/invalid `updatedAt` unknown, never stale/fresh | TC-STATUS-011 | Covered |
| AC-F3-4 | Hygiene: `missing-title`/`missing-labels`; no comment or unmapped custom-field check; conforming zero, non-conforming exact | TC-STATUS-012 | Covered |
| AC-F4-1 | Active change observed/unknown; PR list observed; review state/threads unknown when unavailable; partial failure `degraded` | TC-STATUS-013 | Covered |
| AC-F5-1 | CI reads one bounded check-runs page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), no pagination; classifies every run `failed`/`pending`/`succeeded`/`canceled`/`none`; all-skipped never succeeded; `none` never green; unresolved/failed `unknown` | TC-STATUS-014, TC-STATUS-015 | Covered |
| AC-F6-1 | Lanes always `not-delivered`/`engine-not-delivered`, source `queue-engine`, zero, note; never observed-empty; never duplicates `queue ready` | TC-STATUS-016 | Covered |
| AC-F7-1 | Providers chain/entries/parks; parked vs unverified (never available); chain parked; no chain `unavailable`; park failure `degraded`, no "no parks" | TC-STATUS-017 | Covered |
| AC-F7-2 | No provider engine `resolve`/`quota`, no quota HTTP, no announcement write, no state mutation | TC-STATUS-018 | Covered |
| AC-F8-1 | Parked work observed/empty/absent/malformed; optional age only from `parkedAt`; no fabricated items or notes | TC-STATUS-019 | Covered |
| AC-F9-1 | Exhaustive negative-control matrix: no failure/absence/credential/state/park control becomes observed-zero, clear, green, or available | TC-STATUS-023 | Covered |
| AC-F10-1 | Caps enforced; `counts.omitted` records drops; `truncated` on drops or source-at-limit (raw page vs `STATUS_SOURCE_ITEM_LIMIT` for issues/pulls and `STATUS_SOURCE_PIPELINE_LIMIT` for check runs); `source-truncated`; deterministic ranks | TC-STATUS-007 | Covered |
| AC-F11-1 | `--json` emits exactly one valid envelope with `delivery.status.v1` data, `generatedAt`, `repository`, `summary`, six sections; ≤64 KiB; no `error` on success | TC-STATUS-005 | Covered |
| AC-F11-2 | Human mode: optional header plus one line per section in order, state and counts; ≤24 lines/4096 bytes; no titles/secrets/LLM; zero extra reads; same digest | TC-STATUS-006 | Covered |
| AC-F12-1 | `origin` HTTPS/SSH binding, no userinfo/credentials; absent/unparseable/non-GitHub unavailable; downstream reasons; no new key/remote | TC-STATUS-020, TC-STATUS-021 | Covered |
| AC-F13-1 | List reads exclude PRs, bounded page, no native payload; closed set/capability unchanged; four trap entries with assertions; credentials only via port | TC-STATUS-021, TC-STATUS-022 | Covered |
| AC-F14-1 | Tier, boundary, ambient, forbidden-literal, privacy, secret-read gates green; no new runtime location/subpath; secret allowlist four; no product literal | TC-STATUS-026, TC-STATUS-027, TC-STATUS-028 | Covered |
| AC-F15-1 | No new row/kind; evidence uses existing `config.*`/`state.*` codes or adapter-local classes; provider chain/config validation failure is `failureCode: "config.value.invalid"` + reason `provider-chain-unresolved` + no `failureClass`; config resolution is `config-invalid` + the relevant `config.*` code; `provider.chain.invalid` is never a `failureCode`/`failureClass`; two-way sync and classification green; only fallback failures | TC-STATUS-017, TC-STATUS-029 | Covered |
| AC-F16-1 | Fixture corpus produces expected six sections, states, evidence, ordering, caps, controls with zero live calls; opt-in live structural smoke, no volatile counts | TC-STATUS-030, TC-STATUS-031, TC-STATUS-032 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-STATUS-001, TC-STATUS-002; F-2 → TC-STATUS-002, TC-STATUS-003, TC-STATUS-004; F-3 → TC-STATUS-009, TC-STATUS-010, TC-STATUS-011, TC-STATUS-012; F-4 → TC-STATUS-013; F-5 → TC-STATUS-014, TC-STATUS-015; F-6 → TC-STATUS-016; F-7 → TC-STATUS-017, TC-STATUS-018; F-8 → TC-STATUS-019; F-9 → TC-STATUS-023; F-10 → TC-STATUS-007; F-11 → TC-STATUS-005, TC-STATUS-006; F-12 → TC-STATUS-020, TC-STATUS-021 (credential-reference composition guard traced to F-12/DEC-5, not an AC-F12-1 criterion); F-13 → TC-STATUS-021, TC-STATUS-022; F-14 → TC-STATUS-024, TC-STATUS-025, TC-STATUS-026, TC-STATUS-027, TC-STATUS-028; F-15 → TC-STATUS-017, TC-STATUS-029; F-16 → TC-STATUS-030, TC-STATUS-031, TC-STATUS-032, TC-STATUS-033.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; the table above carries the forward direction. All 24 ACs are covered; there is no deferred AC and no uncovered AC.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` or `EVT-#` identifiers and no HTTP endpoint or event (Section 8.1/8.2). The machine data-model surface is DM-1..DM-15; each is mapped to TCs below.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| DM-1 — `StatusDigest` | `schemaVersion`, injected `generatedAt`, `repository`, `summary` counts incl. `actionable`, exactly six sections | TC-STATUS-002, TC-STATUS-005 | Covered |
| DM-2 — `StatusSection` | `id`, `title`, `state`, bounded `evidence`, uniform `counts`, ranked `items`/section fields, `truncated` | TC-STATUS-003 | Covered |
| DM-3 — Section states | Closed five-value vocabulary and observed-vs-item-unknown distinction | TC-STATUS-004 | Covered |
| DM-4 — Evidence model | ≤6 sources `{source,outcome,failureCode?,failureClass?}`, ≤6 unique reasons, closed vocabularies, no raw payload; pinned provider-config identity | TC-STATUS-003, TC-STATUS-008, TC-STATUS-017, TC-STATUS-023, TC-STATUS-029 | Covered |
| DM-5 — Tracker section | Four fixed-order families, per-family state/reason/items/counts, item fields | TC-STATUS-009, TC-STATUS-010, TC-STATUS-011, TC-STATUS-012 | Covered |
| DM-6 — Changes/PRs section | `activeChange` observed/observed-empty/unknown; capped ranked `pullRequests` with refs/state and observed-or-unknown review signals | TC-STATUS-013 | Covered |
| DM-7 — CI section | `commit {branch,sha?}`, `result`, capped `runs` with normalized job states and trace evidence, read from one bounded check-runs page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20) with no pagination | TC-STATUS-014, TC-STATUS-015 | Covered |
| DM-8 — Lanes-or-queue | Always `not-delivered`, `capability`, `expectedStory`, zero items/counts, note | TC-STATUS-016 | Covered |
| DM-9 — Providers | `chain` declared/absent/parked/unknown; capped entries with `parked`/`unverified`; capped active parks | TC-STATUS-017 | Covered |
| DM-10 — Parked work | `source {kind,path,tracked:false}`; capped items with optional branch/folder/reason/parkedAt/age and observed/unknown item state; no notes | TC-STATUS-019 | Covered |
| DM-11 — Repository binding | observed `{host,owner,name,remoteName}` or unavailable `{reason}`; no userinfo/credential/raw URL | TC-STATUS-020 | Covered |
| DM-12 — Bounds and ordering | Fixed order, caps, read limits, rank keys, truncation rules, counts | TC-STATUS-007, TC-STATUS-008 | Covered |
| DM-13 — Human digest | Appendix E grammar; 24 lines/4096 bytes; derived only from the digest | TC-STATUS-006 | Covered |
| DM-14 — Source availability | Per-source/family signal declaration; unavailable signals yield unknown/unavailable, never empty/zero | TC-STATUS-010, TC-STATUS-013, TC-STATUS-021 | Covered |
| DM-15 — Status schema version | `STATUS_SCHEMA_VERSION = "delivery.status.v1"`, additive within v1 | TC-STATUS-005, TC-STATUS-008 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Section totality: 6/6 sections, 5/5 valid states, 100% evidence presence, 0 missing/extra | TC-STATUS-003, TC-STATUS-004, TC-STATUS-008 | Covered |
| NFR-2 | Bounds: ≤64 KiB machine, ≤24 lines/4096 bytes human, 100% caps, 100% truncation marking | TC-STATUS-005, TC-STATUS-006, TC-STATUS-007 | Covered |
| NFR-3 | Non-verdict guarantee: 0 observed-zero/clear/green/available across the exhaustive matrix | TC-STATUS-004, TC-STATUS-023 (and every collector TC contributes a control) | Covered |
| NFR-4 | Read-only/determinism: 0 writes, fences, state mutations, network writes, child processes; 0 digest/human drift | TC-STATUS-024, TC-STATUS-025 | Covered |
| NFR-5 | Output contract: 100% one valid envelope, 100% six-section human lines + optional header, 0 extra render reads | TC-STATUS-005, TC-STATUS-006 | Covered |
| NFR-6 | Fixture corpus expected; default-CI live calls 0; opt-in live structural checks 100%, no volatile counts | TC-STATUS-030, TC-STATUS-031, TC-STATUS-032 | Covered |
| NFR-7 | Boundaries/branding: 0 new runtime-API locations, 0 new secret-read entries, 0 product literals, gates green | TC-STATUS-026, TC-STATUS-027, TC-STATUS-028 | Covered |
| NFR-8 | Error-table stability: 0 new rows/kinds, 0 documented drift, 0 existing-row changes; sync/classification green; provider-config identity pin holds | TC-STATUS-017, TC-STATUS-029 | Covered |
| NFR-9 | Performance: ≤50 ms pure aggregation, ≤3 network reads, ≤1 logical park-fold read (`readProviderParkViews` invocation; internal verified reads not multiplied), ≤1 config resolve, 0 retries/loops | TC-STATUS-033 | Covered |
| NFR-10 | Privacy: 0 secrets/raw payloads in digest/evidence/human; 0 ambient reads outside the allowlist; 0 canary escapes | TC-STATUS-005, TC-STATUS-006, TC-STATUS-027 | Covered |

All ten NFRs are covered. No NFR is marked TODO or deferred.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Behaviour — command surface/envelope | `bun test tests/behaviour/status-command.test.ts` | `tests/behaviour/status-command.test.ts`, `tests/fixtures/status/harness.ts` | TC-STATUS-001, TC-STATUS-002, TC-STATUS-021 (composition guard/restored control) |
| Behaviour — totality/matrix | `bun test tests/behaviour/status-section-states.test.ts` | `tests/behaviour/status-section-states.test.ts`, `tests/fixtures/status/matrix/**` | TC-STATUS-003, TC-STATUS-004 |
| Behaviour — output/bounds | `bun test tests/behaviour/status-output.test.ts` | `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/bounds/**` | TC-STATUS-005, TC-STATUS-006, TC-STATUS-007 |
| Behaviour — tracker | `bun test tests/behaviour/status-tracker.test.ts` | `tests/behaviour/status-tracker.test.ts`, `tests/fixtures/status/tracker/**`, reused `tests/fixtures/providers/{github,jira}/**` | TC-STATUS-009, TC-STATUS-010, TC-STATUS-011, TC-STATUS-012 |
| Behaviour — changes/CI | `bun test tests/behaviour/status-changes-ci.test.ts` | `tests/behaviour/status-changes-ci.test.ts`, `tests/fixtures/status/{changes,ci}/**` | TC-STATUS-013, TC-STATUS-014, TC-STATUS-015 |
| Behaviour — lanes/providers/parked | `bun test tests/behaviour/status-providers-parked.test.ts` | `tests/behaviour/status-providers-parked.test.ts`, `tests/fixtures/status/{providers,parked,pm-context}/**`, `tests/fixtures/state/harness.ts` | TC-STATUS-016, TC-STATUS-017, TC-STATUS-018, TC-STATUS-019 |
| Behaviour — repository binding | `bun test tests/behaviour/status-repository.test.ts` | `tests/behaviour/status-repository.test.ts`, `tests/fixtures/status/repository/**`, temp git-shaped dirs | TC-STATUS-020 |
| Behaviour — GitHub collection | `bun test tests/behaviour/providers/github-collection.test.ts` | `tests/behaviour/providers/github-collection.test.ts`, `tests/fixtures/providers/github/**`, `tests/fixtures/providers/traps/github.traps.json` | TC-STATUS-021, TC-STATUS-022 |
| Behaviour — negative controls | `bun test tests/behaviour/status-negative-controls.test.ts` | `tests/behaviour/status-negative-controls.test.ts`, `tests/fixtures/status/negative-controls/**` | TC-STATUS-023 |
| Behaviour — read-only/determinism | `bun test tests/behaviour/status-readonly-determinism.test.ts` | `tests/behaviour/status-readonly-determinism.test.ts`, `tests/fixtures/state/harness.ts`, `tests/behaviour/verify-support.ts` | TC-STATUS-024, TC-STATUS-025 |
| Behaviour — corpus/golden | `bun test tests/behaviour/status-corpus.test.ts`; `bun test tests/golden/status-digest.test.ts` | `tests/behaviour/status-corpus.test.ts`, `tests/golden/status-digest.test.ts`, `tests/fixtures/status/corpus/**`, `tests/fixtures/status/golden/**` | TC-STATUS-030, TC-STATUS-031 |
| Behaviour — opt-in live | `ADOS_STATUS_LIVE=1 bun test tests/behaviour/status-live.test.ts` | `tests/behaviour/status-live.test.ts` (skipped without the switch) | TC-STATUS-032 |
| Behaviour — performance | `bun test tests/behaviour/status-performance.test.ts` | `tests/behaviour/status-performance.test.ts`, `tests/fixtures/status/bounds/cap-sized/**` | TC-STATUS-033 |
| Structure — contracts/constants | `bun test tests/structure/status-contract.test.ts` | `tests/structure/status-contract.test.ts`, `tests/structure/inventory.json` | TC-STATUS-008 |
| Structure — tier/purity/imports | `bun test tests/structure/status-imports.test.ts` | `tests/structure/status-imports.test.ts` (pattern from `verify-imports.test.ts`) | TC-STATUS-026, TC-STATUS-027 |
| Structure — provider surface/traps | `bun test tests/structure/provider-surface.test.ts`; `bun test tests/structure/trap-catalog.test.ts` | existing suites extended | TC-STATUS-021, TC-STATUS-022 |
| Structure — subpaths/inventory/edge | `bun test tests/structure/subpaths.test.ts`; `bun test tests/structure/content-inventory.test.ts`; `bun test tests/structure/cli-edge-seam.test.ts` | existing suites extended | TC-STATUS-026, TC-STATUS-028 |
| Checks — error table/secret/literals | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/checks/secret-read-boundary.test.ts`; `bun test tests/checks/forbidden-literals.test.ts` | existing suites/checks | TC-STATUS-027, TC-STATUS-029 |
| Boundaries / ambient / entrypoints | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` | existing harnesses; no new rule | TC-STATUS-028 |
| Aggregate and non-regression | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Status-Harness Contract (binding for every status behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `status` command definition with injected dependencies (`brand`, `clock`, `newRunId`, `secrets`, `program`, and the status source readers) and calls `runCli(argv, streams, deps)` in process, following `tests/golden/helpers.ts` and the `runCli` contract in `packages/cli/src/index.ts`. No status suite spawns a child process.
2. **Injected reads and time.** The repository binding reader, issues reader, PR reader, check-runs reader, provider-config snapshot, verified park-view reader, and local PM-context reader are injected recording functions. The clock, run id, brand, and streams are injected. No test reads `$HOME`, the wall clock, the real state directory, or the ambient environment where purity is asserted.
3. **Self-materializing fixtures.** Normalized facts are committed under `tests/fixtures/status/**` or built in a fresh `mkdtemp` root from the state harness; no test writes the live tree, `dist/`, or the real local PM context.
4. **One oracle per state cell.** Every matrix, negative-control, and corpus case asserts (a) the section state, (b) the evidence reason set and source outcomes, (c) the counts (`observed`/`unknown`/`total`/`omitted`), (d) the ordered item identities, and (e) `truncated`. A case that merely asserts "not observed" is not sufficient.
5. **Recording seams.** Source readers record call order; the state-store wrapper (reuse `guardStore` from `tests/behaviour/verify-support.ts`) records `read` and throws on `append`/`replaceDocument`/`acquireFence`/`releaseFence`; the provider-engine and quota seams are counting stubs that throw if called; the transport records every request and throws on an unfixtured URL or a non-`GET` method. A recorder that never observes a read is itself a failure (proved by a positive control).
6. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed `runId` (for example `run-status-fixture`), a fixed clock tick (for example `2026-10-31T14:30:00Z`), and a synthetic brand (`tests/golden/helpers.ts`), so the envelope and human text are comparable byte-for-byte.
7. **No handler stream writes.** The status handler returns data or a classified failure; the CLI edge is the only writer. Tests assert the handler is called through `runCli` and that no write occurs outside the edge's single serialization path.

### 4.2 Non-Vacuity Contract (binding for every negative, matrix, overlay, and read-only scenario)

- Every negative fixture carries a distinctive `planted-status-*` canary in a title, reason detail, PM-context `notes`, or provider payload; the fixture builder asserts the intended mutation/omission is present before status runs, and the canary must not appear in stdout, stderr, evidence, or the human digest beyond the allowed bounded/sanitized field.
- Every negative is paired with a restored-or-valid control that reaches `observed` through the same invocation path (for example, the failed issues source restored yields an `observed`/`degraded` tracker with the expected items).
- Every "item-level unknown inside an observed section" fixture is paired with a "section unknown" fixture, so an implementation cannot collapse the two.
- Every cap/truncation fixture has an under-cap control and an over-cap/at-limit control in the same test; the under-cap control must not be marked truncated.
- Every read-only assertion is paired with a seeded-write control that the guarded store/transport detects; every no-engine/no-quota assertion is paired with a counting stub that is proven live by a deliberate call in the control.
- Every structure/mutation test runs on in-memory values or temp copies; the live tree is never written, and the unmutated control is green in the same test.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-STATUS-001 | Command surface: grammar, parser rejection, `--json` only | Happy Path | Critical | High | AC-F1-1 |
| TC-STATUS-002 | Non-observed sections still return one success envelope, exit 0 | Corner Case | Critical | High | AC-F1-3 |
| TC-STATUS-003 | Six-section totality, fixed order, evidence/counts/items/truncation | Happy Path | Critical | High | AC-F2-1, NFR-1 |
| TC-STATUS-004 | Appendix A derivation matrix across all sections and states | Regression | Critical | High | AC-F2-2, NFR-1, NFR-3 |
| TC-STATUS-005 | Machine envelope and digest structure within 64 KiB | Happy Path | Critical | High | AC-F11-1, NFR-2, NFR-5 |
| TC-STATUS-006 | Human digest grammar/bounds, no titles/secrets, zero extra reads | Happy Path | Critical | High | AC-F11-2, NFR-2, NFR-5 |
| TC-STATUS-007 | Caps, omitted counts, truncation markers, deterministic ordering | Regression | Critical | High | AC-F10-1, NFR-2, NFR-4 |
| TC-STATUS-008 | Declared constants and closed vocabularies bound to Appendix C | Regression | Critical | High | AC-F2-1, DM-12, DM-15, NFR-1 |
| TC-STATUS-009 | Owner hand-backs: labels only, absent assignee is not unassigned | Corner Case | Critical | High | AC-F3-1 |
| TC-STATUS-010 | Blocked dependencies: unavailable on GitHub; Jira target semantics | Corner Case | Critical | High | AC-F3-2 |
| TC-STATUS-011 | Stalls: older/fresh/absent/invalid `updatedAt` with injected clock | Corner Case | Critical | High | AC-F3-3 |
| TC-STATUS-012 | Hygiene: title/label findings only, no comment/custom-field checks | Corner Case | Critical | High | AC-F3-4 |
| TC-STATUS-013 | Changes/PRs: active change, PR list, unknown review signals, degraded | Corner Case | Critical | High | AC-F4-1 |
| TC-STATUS-014 | CI result classification: failed/pending/succeeded/canceled/none | Regression | Critical | High | AC-F5-1 |
| TC-STATUS-015 | CI unresolved SHA and failed read are unknown, never green | Negative | Critical | High | AC-F5-1 |
| TC-STATUS-016 | Lanes-or-queue is always not-delivered, never observed-empty | Regression | Critical | High | AC-F6-1 |
| TC-STATUS-017 | Providers: parked vs unverified, chain park, no chain, park failure, config identity pin | Corner Case | Critical | High | AC-F7-1, AC-F15-1, NFR-8 |
| TC-STATUS-018 | Providers perform zero engine/quota/write calls | Negative | Critical | High | AC-F7-2, NFR-4 |
| TC-STATUS-019 | Parked work: observed/empty/absent/malformed, optional age, no notes | Corner Case | Critical | High | AC-F8-1 |
| TC-STATUS-020 | Repository binding: HTTPS/SSH, credential stripping, unavailable forms | Corner Case | Critical | High | AC-F12-1 |
| TC-STATUS-021 | GitHub collection reads: PR exclusion, bounded page, absent signals, anonymous-instance guard | Happy Path | Critical | High | AC-F12-1, AC-F13-1, DM-14 |
| TC-STATUS-022 | Capability unchanged and trap catalog four-field bidirectional coverage | Regression | Critical | High | AC-F13-1, NFR-7, NFR-8 |
| TC-STATUS-023 | Exhaustive negative-control matrix: no false all-clear, incl. anonymous instance | Negative | Critical | High | AC-F9-1, NFR-3 |
| TC-STATUS-024 | Read-only execution: zero writes/fences/mutations/network writes/spawns | Regression | Critical | High | AC-F1-2, AC-F7-2, NFR-4 |
| TC-STATUS-025 | Determinism and byte-identical replay over identical inputs | Regression | Critical | High | AC-F1-2, NFR-4 |
| TC-STATUS-026 | Tier, purity, runtime-API location, no new package/subpath | Regression | Critical | High | AC-F14-1, NFR-7 |
| TC-STATUS-027 | Secret-read allowlist four, no product literals, live-smoke literal test-only | Regression | Critical | High | AC-F14-1, NFR-7, NFR-10 |
| TC-STATUS-028 | Boundary, ambient, entrypoint, and inventory gates | Regression | Critical | High | AC-F14-1, NFR-7 |
| TC-STATUS-029 | Error-table stability and evidence code/class discipline | Regression | Critical | High | AC-F15-1, NFR-8 |
| TC-STATUS-030 | Committed fixture corpus drives all six sections with zero live calls | Regression | Critical | High | AC-F16-1, NFR-6 |
| TC-STATUS-031 | Golden full-digest snapshot and bounds over the corpus | Regression | Important | High | AC-F16-1, NFR-2, NFR-5 |
| TC-STATUS-032 | Opt-in live smoke: structural only, no volatile counts, anonymous control, outside default CI | Regression | Important | Medium | AC-F16-1, NFR-6 |
| TC-STATUS-033 | Performance and read-cost bounds (NFR-9) | Regression | Important | High | NFR-9, AC-F16-1 |

All thirty-three TCs are automated except TC-STATUS-032, which is opt-in automated (skipped without the switch) and manual-when-invoked. Every TC is non-vacuous per §4.2; the controls are named in each scenario.

### 5.2 Scenario Details

#### TC-STATUS-001 - Command surface: grammar, parser rejection, `--json` only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-5
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-command.test.ts`, `tests/fixtures/status/harness.ts`
**Tags**: @backend @cli

**Preconditions**:

- The `status` command definition is composed with injected source readers and a fixed brand/clock/run id.
- A fully-observed fixture reaches a success digest; a counting reader records every source call.
- The parser program includes `status` with no flags and no positionals.

**Steps**:

1. Run `runCli(["status"], streams, deps)` and assert one success envelope, exit `0`, and the full six-section digest.
2. Run `runCli(["status", "--json"], ...)` and assert exactly one `CommandResult` envelope on stdout, no human diagnostic on stdout, and the same `data` digest as step 1 (modulo the fixed run id/timing).
3. Run `runCli(["status", "extra"], ...)` and assert `error.code` is exactly `fallback.invocation`, exit `1`, no `data`, and the source reader call count is `0`.
4. Run `runCli(["status", "--limit", "5"], ...)` and assert `fallback.invocation`, exit `1`, zero source reads; run `--json` plus the unknown flag and assert the same.
5. Assert the status definition declares no command-specific flags and no positionals (`positionals.max` absent/zero), and that `--json` is the only global switch.
6. Assert the handler itself performs no `stdout`/`stderr` write (the harness supplies throwing sinks to the handler invocation and passing sinks to the edge) and returns data or a classified failure only.
7. Positive control: re-run `["status"]` after the rejected invocations and assert exit `0` and six sections.

**Expected Outcome**:

- The exact command surface returns one digest; extra positionals and unknown flags are rejected by the parser with `fallback.invocation`, exit `1`, and zero source reads; `--json` changes only serialization; the handler is write-free and exit-free.

#### TC-STATUS-002 - Non-observed sections still return one success envelope, exit 0

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-9, AC-F1-3, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-command.test.ts`
**Tags**: @backend

**Preconditions**:

- A reachable non-observed fixture in which the repository binding is `observed`; the issues read fails (tracker `unknown`), the PR read fails while the active change is observed (changes/PRs `degraded`), and the check-runs read fails for the resolved checkout SHA (CI `unknown`); providers is `unavailable` (no declared default chain), parked is `unavailable` (no PM context), and lanes is `not-delivered`.
- A fully-observed control fixture.
- `assertEnvelopeContract` from `packages/testkit/src/result-conformance.ts`.

**Steps**:

1. Run `--json status` on the non-observed fixture.
2. Assert exit `0`, exactly one envelope, `assertEnvelopeContract` returns `[]`, no `error` key, and `data.sections` has all six in fixed order.
3. Assert `data.summary` counts the states truthfully (`sections: 6`, `observed: 0`, `degraded: 1`, `unknown: 2`, `unavailable: 2`, `notDelivered: 1`, `actionable: 0`).
4. Assert the fixture injects exactly the reads named in the preconditions (binding observed; issues, PR, and check-runs reads failed) and that this reachable combination produces the asserted states; a no-binding run would skip the issues/PR/check-runs reads and cannot produce this digest.
5. Assert no section is omitted and no section's `evidence.reasons` is empty; assert tracker and CI include `read-failed` for the failed source, changes/PRs carries a closed-set reason for the failed PR source, and `addressing-unresolved`/`remote-unsupported` are absent because the binding is observed.
6. Negative control: assert the run is not a success because a section was dropped or because `data` was replaced by a partial structure; compare the six ids to the constant.
7. Assert only a parser invocation (`status extra`) or an unclassifiable internal failure produces an error envelope; a classified internal containment is asserted separately by a throwing handler control (exit `2`, `fallback.internal`).
8. Positive control: the fully-observed fixture returns exit `0` with six `observed` sections (lanes excepted).

**Expected Outcome**:

- A digest in which no section is `observed` (two `unknown`, one `degraded`, two `unavailable`, one `not-delivered`) is still a success with all six sections and exit `0`; section failures are data, not command failures.

#### TC-STATUS-003 - Six-section totality, fixed order, evidence/counts/items/truncation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-1, DM-2, DM-3, DM-4, AC-F2-1, NFR-1
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-section-states.test.ts`, `tests/fixtures/status/matrix/**`
**Tags**: @backend

**Preconditions**:

- One fixture per section, at least one `observed` and one non-observed per section (lanes is always `not-delivered`).
- The expected section ids and order from Appendix C.

**Steps**:

1. For each fixture, assert `data.sections.map(id)` equals exactly `["tracker","changes-and-prs","ci","lanes-or-queue","providers","parked-work"]`; assert length is exactly `6` and no duplicate/extra id.
2. For every section assert `title` is a non-empty string and `state` is a member of `["observed","degraded","unknown","unavailable","not-delivered"]`.
3. For every section assert `evidence` is an object with `sources` (1..6 entries, each `{source,outcome,...}` with a source id from the eight-value set and an outcome from the five-value set) and `reasons` (1..6 unique strings from the closed reason set).
4. For every section assert `counts` has exactly `{observed, unknown, total, omitted}`, each a non-negative integer, and `observed + unknown <= total`; assert `truncated` is a boolean and present on every section.
5. Assert the section-specific fields exist: tracker `families` in fixed order; changes `activeChange` + `pullRequests`; ci `commit` + `result` + `runs`; lanes `capability` + `expectedStory`; providers `chain` + `entries` + `parks`; parked `source` + `items`.
6. Negative control: remove one section from the digest and assert the assertion fails; rename a state to `clear` and assert it fails; drop `truncated` and assert it fails.
7. Assert the raw serialized digest contains none of the fixture's provider-native keys (`reviewDecision`, `check_suite`, `check_runs`, `issue_links`, `updated_at`, `review_threads`).

**Expected Outcome**:

- Every section carries all required parts with closed vocabularies and no raw provider payload; the six ids and order are exact and no section is missing or extra.

#### TC-STATUS-004 - Appendix A derivation matrix across all sections and states

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, DM-3, DM-14, AC-F2-2, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-section-states.test.ts`, `tests/fixtures/status/matrix/**`
**Tags**: @backend

**Preconditions**:

- A matrix fixture set with one case per Appendix A cell:
  - tracker: all-four-signals-available observed (with one item-level unknown); one family signal unavailable degraded; read failed/credential unknown; no binding/no tracker source unavailable; not-delivered never.
  - changes-and-prs: PR list + active change observed; one source failed or a declared PR signal unavailable degraded; both sources failed unknown; no binding and active source absent unavailable.
  - ci: commit resolved + read succeeded (including no runs) observed; never degraded; unresolved SHA or failed read unknown; no binding unavailable.
  - lanes-or-queue: always not-delivered.
  - providers: config+chain+park fold observed (entries `parked`/`unverified`); config/entries observed but park fold failed degraded; config failed/invalid/unresolved unknown; no default chain unavailable.
  - parked-work: read succeeded, array (including empty) observed; never degraded; malformed/wrong shape unknown; absent unavailable.
- Item-level-unknown fixtures: a tracker stalls item with absent `updatedAt`; a PR with review state unknown while the source declares review state available; a parked item without `workItemRef`.

**Steps**:

1. For each matrix case, run the aggregator and assert the section state and reason(s) match the Appendix A cell exactly.
2. Assert `observed` is produced only when every required read succeeded; for each `degraded`/`unknown`/`unavailable` case assert the specific failing source/reason.
3. Item-level vs section: assert the observed-section cases keep `state: "observed"` while the item state is `unknown` and counted in `counts.unknown`, and the section `unknown` case is not produced by an item signal.
4. Assert lanes is `not-delivered` in every single fixture regardless of other inputs.
5. Negative controls: flip a successful read to a failure in each observed cell and assert the state moves to `unknown`/`degraded` (never stays observed); flip a failure to success and assert the restored control reaches `observed`.
6. Assert no cell yields `observed` with `counts.total === 0` unless the source was genuinely observed-empty with the matching reason.

**Expected Outcome**:

- The specification's matrix is executable: every cell matches, item-level unknowns are preserved inside an observed section, and no failed/absent read is rendered as observed.

#### TC-STATUS-005 - Machine envelope and digest structure within 64 KiB

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DM-1, DM-13, DM-15, AC-F11-1, NFR-2, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/bounds/**`
**Tags**: @backend @golden

**Preconditions**:

- A cap-sized fully-observed fixture (8 items per section/family, 8 provider entries/parks, 8 runs, 8 PRs, 8 parked) with maximum-length (120-char) titles.
- Fixed run id/clock; `assertEnvelopeContract`.

**Steps**:

1. Run `--json status`; assert stdout parses as exactly one JSON document with one trailing newline and no extra output.
2. Assert exit `0` and `assertEnvelopeContract` is `[]`; assert the envelope top-level keys are exactly `{schemaVersion, runId, exitCode, timing, data}` and no `error` key.
3. Assert `data.schemaVersion === "delivery.status.v1"`, `data.generatedAt` parses as an ISO-8601 UTC instant ending in `Z`, `data.repository` is the binding shape, and `data.summary` has exactly `{sections, observed, degraded, unknown, unavailable, notDelivered, actionable}` with `sections === 6`.
4. Assert `data.sections` has the six ids in order and each section's key set matches DM-2 (`id`, `title`, `state`, `evidence`, `counts`, `truncated`, plus its section fields).
5. Serialize `data` with `JSON.stringify` and assert `Buffer.byteLength(...) <= 65536`; also record the full-envelope byte length in the test output (no second hard cap asserted).
6. Negative control: add a ninth item and a 5000-char title to a temp fixture and assert the cap/sanitizer keeps the digest under the bound or the assertion fails loudly (the bound is live, not vacuous).
7. Assert no raw native key or planted secret appears in the serialized data.

**Expected Outcome**:

- The machine digest is exactly one valid envelope with the pinned `delivery.status.v1` structure, all six sections, and a live 64 KiB bound.

#### TC-STATUS-006 - Human digest grammar/bounds, no titles/secrets, zero extra reads

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DM-13, AC-F11-2, NFR-2, NFR-5, NFR-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/bounds/**`
**Tags**: @backend @golden

**Preconditions**:

- A synthetic brand whose `binaryName` is `example-product` (never `ados`).
- A fixture whose item titles contain a distinctive title canary and one title contains a planted secret; the PM-context `notes` contain a notes canary.
- Fixed run id/clock.

**Steps**:

1. Run human mode (`["status"]` without `--json`) and capture stdout.
2. Assert the output has an optional header plus exactly one line per section in fixed order (`tracker`, `changes`, `ci`, `lanes`, `providers`, `parked` labels), so exactly six section lines; each line names the section state and bounded counts.
3. Assert the lanes line is `not-delivered` and names the absent engine; assert the providers line never prints `available`; assert the changes line reports PR count and the unavailable review signal; assert the CI line reports the result and job counts.
4. Assert `stdout` line count ≤ 24 and byte length ≤ 4096; assert truncation `+N` appears on lines whose section is truncated.
5. Assert the title canary, notes canary, and planted secret never appear; assert no ISO timestamp from `generatedAt` appears; assert no LLM/prose marker and no raw payload key.
6. Assert the header uses the injected brand binary name; assert the literal `ados`/`ADOS_` never appears.
7. Assert rendering performs zero extra reads: run `--json` and human mode against the same recorder and assert the source call sequence/counts are identical; assert the human renderer is called once with the digest.
8. Assert the human facts agree with the `--json` digest (section states/counts) for the same fixture.
9. Positive/negative control: a title-only canary must be absent from human but present (capped) in machine; a secret in the digest must be redacted in both.

**Expected Outcome**:

- Human mode is a short, deterministic, six-line digest in fixed order, within the line/byte bounds, containing no titles, secrets, timestamps, or prose, and performing no extra reads.

#### TC-STATUS-007 - Caps, omitted counts, truncation markers, deterministic ordering

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-12, AC-F10-1, NFR-2, NFR-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/bounds/**`
**Tags**: @backend

**Preconditions**:

- Under-cap, exactly-at-cap, over-cap, and source-at-limit fixtures for each section/family:
  - tracker: 3 and 5 items per family; 8 and 9 per section where applicable.
  - changes/PRs: 8 and 9 open PRs.
  - CI: 8 and 9 rendered runs; raw check-runs pages of 19 and 20 returned by a single request at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20).
  - providers: 8 and 9 entries; 8 and 9 parks.
  - parked: 8 and 9 items.
  - issues/PRs source: 99, 100, and 101 raw items (100 = `STATUS_SOURCE_ITEM_LIMIT`).
- Reversed-order twins of each fixture (API/map order reversed) built in tests.

**Steps**:

1. For each over-cap fixture, assert the rendered list length equals the declared cap (`STATUS_MAX_ITEMS_PER_SECTION` 8, family 4, provider entries/parks 8, runs 8, PRs 8, parked 8) and `counts.omitted` equals `total - rendered`.
2. Assert the check-runs read sends `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), is exactly one page, and performs no pagination (a second check-runs page request throws); assert the raw page size (19 or 20) is reported with the runs.
3. Assert `truncated === true` and `evidence.reasons` includes `source-truncated` when the raw page returned exactly its declared read limit (`STATUS_SOURCE_ITEM_LIMIT` 100 for the issues/PR list reads or `STATUS_SOURCE_PIPELINE_LIMIT` 20 for the check-runs read) or when rendered items were dropped.
4. Assert the raw page size drives the source-at-limit signal even when items filter or cap out (GAP-9; spec v1.3 F-10/DM-12/Appendix F): a 100-raw-item issues page with 10 PR objects yields 90 `WorkItem`s but still marks `source-truncated`; a raw check-runs page of exactly 20 runs signals `source-truncated` even though `STATUS_MAX_PIPELINE_RUNS` renders at most 8.
5. Under-cap control: assert `truncated === false`, `omitted === 0`, and no `source-truncated` for the 99-raw-item list pages and the 19-run check-runs page; a raw page below its declared limit never signals it.
6. Ordering: for tracker, assert the exact Appendix D rank keys (owner hand-backs by label group then oldest `updatedAt` then ref; blocked by `dependencyState` unknown→open then ref; stalls oldest then unknown-activity ref; hygiene finding count then ref).
7. For non-tracker sections, assert permutation invariance: the reversed-order twin yields byte-identical item order and counts; assert the chosen declared key is documented and stable (spec v1.3 §8.3 rank-key table, DM-12).
8. Negative controls: an implementation that relies on API order fails the reversed twin; an implementation that drops silently fails the `omitted` assertion; a source-at-limit under-cap control must not be marked truncated; an implementation that omits `per_page` or requests a second page fails the bounded-read assertion.

**Expected Outcome**:

- Every cap is enforced, every drop and source-at-limit is visible in `omitted`/`truncated`/`source-truncated`, and ordering is declared and independent of input order.

#### TC-STATUS-008 - Declared constants and closed vocabularies bound to Appendix C

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-4, DM-12, DM-15, AC-F2-1, NFR-1
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/status-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend @golden

**Preconditions**:

- The change spec Appendix C/D constant table and the §8.3 reason/source/outcome vocabularies are read-only references.
- The status contracts module exports the constants and closed sets as data.

**Steps**:

1. Assert `STATUS_SECTION_ORDER` equals the six ids in order; `STATUS_SECTION_STATES` equals the five states in order.
2. Assert each declared constant equals Appendix C: `STATUS_MAX_ITEMS_PER_SECTION` 8, `STATUS_MAX_TRACKER_FAMILY_ITEMS` 4, `STATUS_MAX_EVIDENCE_SOURCES` 6, `STATUS_MAX_REASONS` 6, `STATUS_MAX_PROVIDER_ENTRIES` 8, `STATUS_MAX_PROVIDER_PARKS` 8, `STATUS_MAX_PIPELINE_RUNS` 8, `STATUS_MAX_OPEN_PULL_REQUESTS` 8, `STATUS_MAX_PARKED_CHANGES` 8, `STATUS_SOURCE_ITEM_LIMIT` 100, `STATUS_SOURCE_PIPELINE_LIMIT` 20, `STATUS_MAX_TITLE_CHARS` 120, `STATUS_MAX_DETAIL_CHARS` 160, `STATUS_MAX_HUMAN_LINES` 24, `STATUS_MAX_HUMAN_BYTES` 4096, `STATUS_MAX_MACHINE_BYTES` 65536, `STATUS_STALL_THRESHOLD_DAYS` 14; assert `STATUS_OWNER_ATTENTION_LABELS` is exactly `["hand-back","human-input-needed"]`; assert `STATUS_SCHEMA_VERSION === "delivery.status.v1"`.
3. Assert the closed reason set equals the twenty listed reasons in the spec; the source ids equal the eight listed; the outcomes equal `["read","observed-empty","failed","not-configured","not-delivered"]`.
4. Assert the contracts module is data-only (no executable statements beyond declarations/`as const`) via the same detector as `tests/structure/verify-imports.test.ts`.
5. Assert the status module is registered in `tests/structure/inventory.json` with the correct executable allowances; an unregistered new module fails the inventory test.
6. Mutation controls in memory/temp copy: reorder the section order, rename a state, drop a reason, change a cap, and change the schema version; each mutation must fail the corresponding assertion; the unmutated control is green.

**Expected Outcome**:

- The vocabulary, order, caps, limits, thresholds, labels, and schema version are pinned to the spec data and any drift fails by name.

#### TC-STATUS-009 - Owner hand-backs: labels only, absent assignee is not unassigned

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-5, DM-14, AC-F3-1, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-tracker.test.ts`, `tests/fixtures/status/tracker/**`, `tests/fixtures/providers/jira/tracker-queries.json`
**Tags**: @backend

**Preconditions**:

- Normalized open `WorkItem` fixtures: `hand-back` label with an assignee; `hand-back` label with absent `assignee`; `human-input-needed` label case-insensitive; open item with a non-attention label; closed/canceled item with an attention label; item with an attention label and blank title (also a hygiene finding).
- A Jira-shaped fixture from `tracker-queries.json` whose unassigned hand-back item has `assignee: null` but whose normalized view has no `assignee`.
- The injected clock.

**Steps**:

1. Run the tracker collector; assert each open attention-labeled item is listed under `ownerHandBacks` with the label as evidence and its `workItemRef`.
2. Assert the absent-`assignee` item is listed (label predicate) and is **not** reported as unassigned; assert no `unassigned` signal appears anywhere in the item or evidence.
3. Assert the case-insensitive `HUMAN-INPUT-NEEDED` item is listed; assert the non-attention item and the closed/canceled attention item are not listed.
4. Assert the family is deterministic: reversed input order yields the same ordered item list; the family is capped at `STATUS_MAX_TRACKER_FAMILY_ITEMS` (4).
5. Assert `counts.total`/`observed` reflect only open attention items and `omitted` any dropped over-cap items.
6. Negative controls: remove the label from the unassigned item and assert it drops out (proving the label is the predicate, not the assignee); add a comment-only signal and assert no effect (comments are not read).

**Expected Outcome**:

- Owner hand-backs are answered from declared labels alone; absent assignee is treated as unknown, never "unassigned"; non-open and non-labeled items are excluded deterministically.

#### TC-STATUS-010 - Blocked dependencies: unavailable on GitHub; Jira target semantics

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-5, DM-14, AC-F3-2, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-tracker.test.ts`, `tests/fixtures/status/tracker/**`, `tests/fixtures/providers/jira/tracker-queries.json`
**Tags**: @backend

**Preconditions**:

- A GitHub-shaped tracker source declaration with `relations: unavailable` (the minimal slice) and an issue fixture whose `relations` is `[]`.
- Jira-shaped `WorkItem` fixtures with `blocked-by` relations: target observed `done`, target observed `canceled`, target observed not done (`ready`/`in-progress`), target not observed, and a self/duplicate relation control.
- A source declaration with `relations: available`.

**Steps**:

1. GitHub case: assert `families.blockedDependencies.state === "unavailable"`, reason `signal-unavailable`, zero items, and no observed-empty family; assert the empty `relations` array is not interpreted as "no blocked items".
2. Jira available case: assert an item whose target is `done` is not listed; an item whose target is `canceled` is not listed; an item whose target is observed not done is listed with `dependencyState: "open"`; an item whose target is unobserved is listed with `dependencyState: "unknown"`.
3. Assert unobserved targets are never reported as resolved/completed and no `done`/`canceled` target is listed as blocked.
4. Assert ordering follows `dependencyState` unknown→open then ref; assert the family is capped and `counts.omitted` reflects drops.
5. Negative controls: a source that declares relations available but returns no relation for one item yields that item as "no blocked-by" (not unknown); a source that declares unavailable must never fall through to an observed-empty family even when all issue relations are empty.
6. Assert the GitHub case is independent of the issues read success (the family is unavailable, but the tracker section state follows the matrix).

**Expected Outcome**:

- GitHub blocked dependencies are truthfully unavailable, never empty; Jira-shaped targets distinguish open, done/canceled, and unobserved/resolved-unknown exactly.

#### TC-STATUS-011 - Stalls: older/fresh/absent/invalid `updatedAt` with injected clock

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-5, AC-F3-3, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-tracker.test.ts`, `tests/fixtures/status/tracker/**`, `tests/fixtures/providers/jira/stalls.json`
**Tags**: @backend

**Preconditions**:

- An injected clock fixed to `2026-10-31T00:00:00Z`.
- Open items with `updatedAt`: 15 days old (stalled), exactly 14 days old (at threshold), 13 days old (fresh), absent, invalid (`"not-a-date"`), and an item with comments but absent `updatedAt`.
- A fixture whose only activity is comments.

**Steps**:

1. Assert the 15-day item is `stalled` with `ageDays` 15; assert the 14-day item is at/under threshold and not listed (pin `>` threshold); assert the 13-day item is not listed.
2. Assert the absent-`updatedAt` item is listed as `unknown` activity, never `stalled` or `active`; assert the invalid item is `unknown`; assert `ageDays` is absent for both.
3. Assert the comments-only item with absent `updatedAt` is `unknown`, proving no timestamp is derived from comments.
4. Advance the injected clock by one day and assert the ages/threshold change deterministically; assert the wall clock is never read.
5. Assert ordering: oldest stalled first, then unknown-activity items by ref; assert the family cap and `omitted`.
6. Negative controls: fabricate a date from the current time and assert the test fails (the clock is injected); derive a timestamp from ordering and assert no effect.

**Expected Outcome**:

- Stalls are computed only from a parseable provider `updatedAt` against the injected clock; absent/invalid activity is `unknown`, never stale or fresh.

#### TC-STATUS-012 - Hygiene: title/label findings only, no comment/custom-field checks

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-5, AC-F3-4, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-tracker.test.ts`, `tests/fixtures/status/tracker/**`, `tests/fixtures/providers/jira/{comments-omitted,custom-fields}.json`
**Tags**: @backend

**Preconditions**:

- Open items: blank/empty title; empty label set; blank title + empty labels; conforming item; item with comments present; item with an unmapped custom field missing.
- A Jira-shaped item whose comments are omitted and whose custom field is unmapped.

**Steps**:

1. Assert the blank-title item has exactly `missing-title`; the empty-label item has exactly `missing-labels`; the both-missing item has both findings in the declared order.
2. Assert the conforming item has zero findings and is not listed.
3. Assert no finding is produced for comment conformance (comments present or omitted) or for an unmapped custom field; assert the item with an absent comment payload is not flagged.
4. Assert the family never reports a pass based on an absent signal; an item with absent labels is `missing-labels` (empty set), not skipped.
5. Assert the family is capped and ordered by finding count then ref.
6. Negative controls: add a comment to a conforming item and assert no new finding; remove a mapped field and assert the expected finding; an unmapped custom-field fixture must produce identical findings to the same item without the custom field.

**Expected Outcome**:

- Hygiene evaluates only normalized title and label conformance; comments and unmapped custom fields are never evaluated and never become a pass.

#### TC-STATUS-013 - Changes/PRs: active change, PR list, unknown review signals, degraded

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-6, DM-14, AC-F4-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-changes-ci.test.ts`, `tests/fixtures/status/changes/**`
**Tags**: @backend

**Preconditions**:

- PM-context fixtures: observed `active_change` with `workItemRef`/`branch`/`changeFolder`; `observed-empty`; absent; malformed YAML; wrong shape.
- PR-list fixtures: 2 open PRs with refs/draft/state; a source declaration with `reviewState: unavailable` and `reviewThreads: unavailable`; a source declaration with review state available but one item unknown.
- Partial-failure fixture: PR read fails, PM context observed.

**Steps**:

1. Assert `activeChange.state === "observed"` with the three fields; assert `observed-empty` and `unknown` are distinct (absent/malformed → `unknown`, never "none"/empty).
2. Assert the open PR list is reported with `entityId`, `sourceRef`, `targetRef`, delivery state/draft; assert merged/closed PRs are not in the open list.
3. With review state/threads unavailable, assert those item signals are `unknown`/`signal-unavailable`, never `open` or `0`; assert the section state is `degraded` when a declared PR signal is unavailable (per Appendix A).
4. With review state declared available but one PR's signal absent, assert the item signal is `unknown` while the section state follows the matrix (observed if all required reads succeeded; the item unknown is counted).
5. Partial failure: assert the section is `degraded`, the active change is preserved, the PR list is marked unknown, and the reason is present; assert the CI/other sections are unaffected.
6. Assert ordering/permutation invariance and the PR cap (`STATUS_MAX_OPEN_PULL_REQUESTS`).
7. Negative controls: a missing PM context must not become an observed-empty active change; a review signal must not be defaulted to `open`/zero.

**Expected Outcome**:

- The active change and PR list are truthful; absent/malformed PM context is unknown; unavailable review signals are unknown; a partial source failure is degraded with the other sections intact.

#### TC-STATUS-014 - CI result classification: failed/pending/succeeded/canceled/none

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-7, AC-F5-1, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-changes-ci.test.ts`, `tests/fixtures/status/ci/**`, `tests/fixtures/providers/github/check-runs-per-sha.json`
**Tags**: @backend

**Preconditions**:

- Pipeline-run fixtures for the same resolved SHA: one failed; one running + one succeeded; one queued only; one succeeded only; one succeeded + one skipped; one canceled; one canceled + one succeeded; no runs; all runs skipped; one skipped only.
- The injected branch/SHA facts.

**Steps**:

1. Assert the section is `observed` for every case whose SHA resolved and read succeeded (including no runs), per Appendix A.
2. Assert `result`:
   - any failed → `failed`;
   - any running/queued and none failed → `pending`;
   - any canceled and none worse → `canceled`;
   - at least one succeeded and all others succeeded/skipped → `succeeded`;
   - no runs, or every run skipped → `none`.
3. Assert an all-skipped set is never `succeeded`; assert `none` is never `succeeded`/green and is a distinct token.
4. Assert `commit` carries the branch (attached) and full SHA; assert only the current checkout HEAD is observed (no other SHA/branch query); assert the check-runs read is one bounded page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20) with no second page request, and every run on that page is classified.
5. Assert runs are capped at `STATUS_MAX_PIPELINE_RUNS`, normalized job states are from the closed set, and trace evidence is a reference not a raw payload.
6. Precedence controls: failed + running → `failed`; running + canceled → `pending`; canceled + succeeded → `canceled`.
7. Negative control: a `none` result must not print green in human mode; an all-skipped result must not be described as succeeded.

**Expected Outcome**:

- CI classification follows the declared precedence, `none` and all-skipped are never green, and the observed commit is only the checkout HEAD.

#### TC-STATUS-015 - CI unresolved SHA and failed read are unknown, never green

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-7, AC-F5-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-changes-ci.test.ts`, `tests/fixtures/status/ci/**`
**Tags**: @backend

**Preconditions**:

- Cases: detached HEAD with unresolved SHA; missing HEAD; check-runs read failure (`read-failed`); credential unavailable; repository binding unavailable.
- A restored control with a resolved SHA and a passed read.

**Steps**:

1. For each failure case, assert `section.state === "unknown"` (or `unavailable` for no binding), `section.result === "unknown"`, the reason is `commit-unresolved`/`read-failed`/`credential-unavailable`, and the failure class/code is present.
2. Assert no case yields `succeeded`, `failed`, `pending`, `canceled`, or `none` when the commit/read is untrustworthy; assert the human line is not green.
3. Assert the reason/evidence contain no raw transport body, no credential, and no exception stack.
4. Assert the section still has counts/items/truncated and is included in the six-section digest.
5. Restored controls: the same fixture with the SHA/read restored yields the expected `observed` result.
6. Assert a read failure does not silently retry or loop (transport call count is exactly one attempt; a second request throws).

**Expected Outcome**:

- An unresolved commit or failed CI read is `unknown` with a reason and class, never a green claim; no retry loop occurs.

#### TC-STATUS-016 - Lanes-or-queue is always not-delivered, never observed-empty

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-8, AC-F6-1, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-providers-parked.test.ts`
**Tags**: @backend

**Preconditions**:

- Every other section is varied across observed/unknown/unavailable fixtures (to prove independence).

**Steps**:

1. For every fixture, assert `lanes-or-queue.state === "not-delivered"`, `capability === "queue-lane-engine"`, `expectedStory === "M2-S1"`, and the reason set is exactly `["engine-not-delivered"]`.
2. Assert `items` is empty, all counts are `0`, and `truncated` is `false`; assert the note states no queue/lane engine exists in this release.
3. Assert the section is never `observed`, never an empty observed queue, and never a fabricated queue.
4. Assert no section or item duplicates `queue ready` (no queue-ready item/state/token) and no queue-engine read is attempted (the source recorder shows zero reads for `queue-engine`).
5. Negative controls: force the collector to return `observed`/`[]` and assert the test fails; force a `queue ready` item and assert it fails.

**Expected Outcome**:

- The queue section is always a declared, evidenced `not-delivered` gap, independent of all other inputs, with no queue read and no duplication of `queue ready`.

#### TC-STATUS-017 - Providers: parked vs unverified, chain park, no chain, park failure

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-15, DM-4, DM-9, DM-14, AC-F7-1, AC-F15-1, NFR-3, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-providers-parked.test.ts`, `tests/fixtures/status/providers/**`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- Resolved provider-config snapshots: (a) default chain + declared entries; (b) same + an active provider park (`provider:` prefix); (c) same + an active chain park (`chain:` prefix); (d) no default chain (`provider.defaultChain` absent, `provider.chains` empty); (e) chain declared but not resolving to declared entries; (f) park fold failure; (g) provider config read failed or invalid.
- The pinned evidence identity from spec F-15/DM-4/DM-9: a provider chain/config validation failure carries `failureCode: "config.value.invalid"` + reason `provider-chain-unresolved` + **no** `failureClass`; a config-resolution failure carries reason `config-invalid` + the relevant existing `config.*` code; the error-table row `provider.chain.invalid` is never used as a `failureCode` or `failureClass`.
- Verified park views built with the state harness (`foldParks`/`parkView`) with `expiresAt` on both sides of the injected clock.
- Counting provider-engine/quota stubs.

**Steps**:

1. Case (a): assert the chain is `declared` with its name/entries; assert entries are listed (capped at `STATUS_MAX_PROVIDER_ENTRIES`) and every no-park entry is `unverified`; assert no entry is `available`.
2. Case (b): assert the parked entry is `parked` with cause, conditions, and expiry; assert other entries are `unverified`; assert the chain is not `available`.
3. Case (c): assert the chain is `parked` (chain park), with cause/expiry; assert entries remain `unverified`/`parked` truthfully.
4. Case (d): assert `section.state === "unavailable"` with `provider-chain-not-declared`; assert zero entries/parks and no `available`.
5. Case (e): assert `section.state === "unknown"`; assert `evidence.reasons` contains exactly `provider-chain-unresolved`; assert the `provider-config` source entry has `failureCode: "config.value.invalid"` and **no** `failureClass`; assert no fabricated entries; assert the error-table row `provider.chain.invalid` appears nowhere in the evidence or digest as a `failureCode` or `failureClass`.
6. Case (g): assert `section.state === "unknown"`; assert `evidence.reasons` contains `config-invalid`; assert the `provider-config` source entry has the relevant existing `config.*` code as `failureCode` (for example `config.value.invalid`) and **no** `failureClass`; assert `provider.chain.invalid` is not used as a `failureCode` or `failureClass`.
7. Case (f): assert `section.state === "degraded"`, entries observed, parks unknown, the state failure code present, and no "no parks" claim; assert the parks list is not silently empty-observed.
8. Assert expiry is read-time: a park at T−1 is active, at T is expired/inactive, at T+1 stays expired with no write.
9. Assert caps at `STATUS_MAX_PROVIDER_ENTRIES`/`STATUS_MAX_PROVIDER_PARKS` and `omitted`/`truncated`.
10. Negative controls: mark a no-park entry `available` and assert the test fails; render a park read failure as "0 parks" and assert the test fails; render no chain as an empty observed chain and assert the test fails; assign `provider.chain.invalid` as the case-(e) `failureCode` or `failureClass` and assert the identity assertion fails.

**Expected Outcome**:

- Providers report the declared chain/entries and verified active parks; availability is `parked` or `unverified` only; absent chain is unavailable; a chain/config validation failure is `unknown` with `failureCode: "config.value.invalid"` + `provider-chain-unresolved` and no `failureClass`; a config-resolution failure is `unknown` with `config-invalid` + the relevant `config.*` code; `provider.chain.invalid` is never an evidence identity; park failure is degraded with no false all-clear.

#### TC-STATUS-018 - Providers perform zero engine/quota/write calls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-14, AC-F7-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-providers-parked.test.ts`, `tests/behaviour/status-readonly-determinism.test.ts`
**Tags**: @backend

**Preconditions**:

- Counting stubs for `provider.resolve`, `provider.quota`, and the quota HTTP transport, each recording and throwing on call.
- A guarded state store (reuse `guardStore`) that records reads and throws on mutation.
- A fully-observed providers fixture.

**Steps**:

1. Run status and assert the provider-engine `resolve` count is `0`, `quota` count is `0`, and quota transport request count is `0`.
2. Assert no `provider.announcement`/`provider.park` record is appended and no state mutation/fence is attempted (guarded store throws if so).
3. Assert the park read is a single verified read (count `<= 1`) and the config resolve is a single resolve (count `<= 1`).
4. Positive control: a deliberate engine/quota call in the test control trips the stub; a deliberate state append trips the guard. This proves the seams are live.
5. Assert the providers section is still produced from config + park views without the engine.

**Expected Outcome**:

- Status never executes the provider engine, fetches quota, writes an announcement/park, or mutates state; the read seams are proven live.

#### TC-STATUS-019 - Parked work: observed/empty/absent/malformed, optional age, no notes

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-10, AC-F8-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-providers-parked.test.ts`, `tests/fixtures/status/pm-context/**`
**Tags**: @backend

**Preconditions**:

- PM-context fixtures: absent file; explicit empty array; one observed entry with `workItemRef`/`branch`/`changeFolder`/`reason`/`parkedAt`; an entry without `workItemRef`; malformed YAML; `parked_changes` as a map/non-array; a `notes` array with a canary; an entry with an invalid `parkedAt`.
- Injected clock.

**Steps**:

1. Observed: assert `section.state === "observed"`, items list the projected fields in order, the `source` is `{kind:"local-pm-context", path, tracked:false}`, and the git-ignored marker is explicit.
2. Explicit empty: assert `state === "observed"`, reason `observed-empty`, zero items; assert it is distinct from unavailable.
3. Absent: assert `state === "unavailable"`, reason `local-context-missing`, the git-ignored marker, zero fabricated items; assert it is not "0 parked changes" as an observed claim.
4. Malformed YAML / non-array: assert `state === "unknown"`, reason `local-context-malformed`, no crash and no raw parser bytes.
5. Item without `workItemRef`: assert the section may remain observed and the item state is `unknown`, counted in `counts.unknown`.
6. Age: assert `ageDays` derives only from a present parseable `parkedAt` against the injected clock; absent/invalid `parkedAt` yields no age (unknown).
7. Notes: assert the `notes` canary never appears in the digest or human text; assert only the five projected fields cross the boundary.
8. Caps/ordering: assert `STATUS_MAX_PARKED_CHANGES` and permutation invariance.

**Expected Outcome**:

- Parked work is truthful across all four source conditions, age is never fabricated, and free-form notes never enter the digest.

#### TC-STATUS-020 - Repository binding: HTTPS/SSH, credential stripping, unavailable forms

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-11, AC-F12-1, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-repository.test.ts`, `tests/fixtures/status/repository/**`
**Tags**: @backend

**Preconditions**:

- Origin URLs: `https://github.com/owner/name.git`; `https://github.com/owner/name`; `git@github.com:owner/name.git`; `ssh://git@github.com/owner/name.git`; `https://user:token@github.com/owner/name.git`; no origin; unparseable `not a url`; non-GitHub `https://gitlab.com/owner/name.git`; a linked-worktree `.git` file.
- A bounded repo reader with injected `RepositoryIo` over a temp `.git/config`/`HEAD` directory (no child process).
- Downstream fixtures for tracker/changes/CI with an unavailable binding.

**Steps**:

1. Assert each GitHub HTTPS/SSH form resolves to `{host:"github.com", owner, name, remoteName:"origin"}`.
2. Assert the userinfo/token form strips credentials: no user, password, token, or raw URL appears anywhere in the binding, evidence, or serialized digest.
3. Assert no origin, unparseable origin, and non-GitHub host yield `state: "unavailable"` with `addressing-unresolved` or `remote-unsupported`; assert no alternate remote is searched and no config key is read.
4. Assert downstream propagation: tracker `unavailable`, CI `unavailable`; changes/PRs `unavailable` when the active source is absent, `degraded` when the active change is observed and PRs unknown; the reasons are the binding reasons.
5. Assert the adapter reads bounded git metadata (`config`/`HEAD`) with no `child_process` import and no spawn (AST + runtime sentinel).
6. Assert the linked-worktree `.git` file is handled; a non-git directory is unavailable, not a guessed binding.
7. Negative control: a remote with a credential and a non-GitHub host must not be accepted by a permissive parse; a mutation control (strip `.git`, swap host) changes the result as expected.

**Expected Outcome**:

- Repository addressing is derived only from `origin`, supports both GitHub URL forms, never leaks credentials, and fails truthfully for absent/unparseable/non-GitHub cases with correct downstream states.

#### TC-STATUS-021 - GitHub collection reads: PR exclusion, bounded page, absent signals

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, F-13, DEC-5, DM-14, AC-F12-1, AC-F13-1, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-collection.test.ts` (read-side steps 1–6, 8) + `tests/behaviour/status-command.test.ts` (composition-guard/restored-control steps 7, 9), `tests/fixtures/providers/github/**`
**Tags**: @backend

**Preconditions**:

- A mixed issues page containing issue objects and pull-request objects; a 100-item page at `STATUS_SOURCE_ITEM_LIMIT`; an issue without structured links; a PR list page with no review decision/threads.
- The injected fixture transport (records requests; throws on unfixtured URL/non-GET) and the credential port.
- A native-key sentinel list (`reviewDecision`, `head`, `base`, `sha`, `issue_links`, `check_suite`, `check_runs`, `updated_at`).
- A credential-less/anonymous GitHub `ExternalSystemInstance` (`authMethod.mechanism: "anonymous"`) injected into the status composition, with a fixture transport that would return a 2xx if any read were attempted. The control is satisfiable through the spec F-12/DEC-5 composition guard and does **not** assume the GitHub client itself rejects an anonymous instance. The guarded per-section expectation is pinned in step 7 (tracker `unknown`, CI `unknown`, changes-and-prs `degraded` while the active change is observed).

**Steps**:

1. `listWorkItems(limit)`: assert exactly one request to the issues endpoint with `state=open`, the declared limit, and the declared sort; assert the returned `WorkItem` set excludes every pull-request object from the mixed page.
2. Assert the page limit is the declared `STATUS_SOURCE_ITEM_LIMIT`; assert a source-at-limit page marks the status truncation signal, and a below-limit page does not.
3. Assert an issue with no structured links normalizes `relations: []` and the tracker declares blocked dependencies unavailable (not empty/zero).
4. `listDeliveryRequests(limit)`: assert one bounded PRs page and normalized `DeliveryRequest` items with refs/draft/state; assert the list's absent review decision/threads are not trusted as `open`/`0` and status reports them unknown.
5. Assert no provider-native payload key crosses the subpath surface or the status digest; assert the serialized result contains none of the sentinels.
6. Assert credentials resolve only through `CredentialPort`: a missing/rejected credential yields a classified read failure (evidence), not a command failure; assert no ambient env read.
7. Anonymous/credential-less control: inject the `authMethod.mechanism: "anonymous"` instance into the composition and assert it is refused before any read — the recording transport shows zero requests. The guard withholds only the GitHub reads and leaves the local PM context untouched, so pin the per-section outcome explicitly: `tracker` is `unknown` with `credential-unavailable`; `ci` is `unknown` with `credential-unavailable`; `changes-and-prs` is `degraded` with `partial-evidence` plus `credential-unavailable` on the refused PR read while the local active change is `observed`, and is `unknown`/`unavailable` only when the fixture makes the active-change source absent or unusable. No affected section is ever `observed`. Assert the refusal comes from the composition guard, not from the client rejecting anonymous auth (the fixture transport is live and would answer a read).
8. Negative controls: an unfixtured URL throws (no live fallback); a non-GET method throws; a mixed page with the PR filter removed yields a failing assertion; a composition that skips the anonymous guard and reads anonymously yields a failing assertion (the affected sections must not become `observed`).
9. Restored control: the same composition with the credential-reference instance reaches the normal Appendix A states through the same fixture transport — `tracker` and `ci` `observed`; `changes-and-prs` `degraded` because the GitHub slice declares review state/threads unavailable (unless the fixture explicitly declares them available, in which case it is `observed`). This proves the anonymous control is not vacuous.

**Expected Outcome**:

- Collection reads are one bounded page each, exclude PRs from issues, preserve absent relations/review signals as unavailable/unknown, never leak native payloads, and authenticate only through the credential port. An anonymous/credential-less instance is refused at composition before any read; the guard withholds only the GitHub reads, so `tracker` and `ci` are `unknown` and `changes-and-prs` is `degraded` while the local active change is observed (`unknown`/`unavailable` only when the active-change source is also absent or unusable), and no affected section is ever `observed`. The credential-reference restored control returns `tracker`/`ci` `observed` and `changes-and-prs` `degraded` on the GitHub slice (or `observed` only when the fixture declares the review signals available).

#### TC-STATUS-022 - Capability unchanged and trap catalog four-field bidirectional coverage

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-7, NFR-8
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/trap-catalog.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/structure/port-contract-inventory.test.ts`, `tests/behaviour/providers/trap-harness.ts`
**Tags**: @backend @golden

**Preconditions**:

- The delivered `GITHUB_ADAPTER_CONTRACT` and `ADAPTER_OPERATIONS`.
- The extended `tests/fixtures/providers/traps/github.traps.json` with four new entries: `GITHUB-LIST-EXCLUDES-PRS`, `GITHUB-LIST-PAGE-LIMIT`, `GITHUB-ISSUE-RELATIONS-ABSENT`, `GITHUB-PR-LIST-REVIEW-DEFAULT` (plus the three existing entries).

**Steps**:

1. Assert `GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations` is exactly `["read-work-item","read-delivery-request","read-pipeline-run"]` and the write gaps are unchanged; assert `ADAPTER_OPERATIONS` gains no `list-*` operation and no new carrier.
2. Assert the GitHub client's exported surface still contains only the factory, `GithubClient`, `GithubClientOptions`, `GithubRepositoryRef`, and `GITHUB_ADAPTER_CONTRACT`; assert no provider-native/parallel view type appears; assert `readPipelineRun` keeps its method name and gains only the optional declared page limit (`per_page=STATUS_SOURCE_PIPELINE_LIMIT`) with raw-page-size reporting and no new export.
3. Assert every GitHub trap entry has exactly the four fields (`trapName`, `providerBehavior`, `expectedNormalizedOutcome`, `fixtureReference`), unique stable names, and resolvable `path#/json-pointer` fixture references.
4. Assert `trapCoverageFailures` is empty for the GitHub catalog and its assertions; assert each of the four new entries has a matching assertion and each assertion has an entry.
5. Assert the mutation controls: deleting an entry leaves an assertion without an entry; deleting an assertion leaves an entry without an assertion; both fail by name.
6. Assert the expected trap list/minima in `trap-catalog.test.ts` is updated to seven GitHub entries (the four new plus three existing) and the mutation of the expected list fails.

**Expected Outcome**:

- The closed operation set and capability declaration are unchanged; list reads are query-shaped existing operations; the trap catalog stays four-field data with bidirectional coverage and a matching assertion for every new quirk.

#### TC-STATUS-023 - Exhaustive negative-control matrix: no false all-clear

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-12, DEC-5, DM-3, DM-4, DM-14, AC-F9-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-negative-controls.test.ts`, `tests/fixtures/status/negative-controls/**`
**Tags**: @backend @golden

**Preconditions**:

- The ten AC-F9-1 controls plus the credential-less/anonymous composition control, each with a restored control:
  1. failed issues read;
  2. failed PR read;
  3. failed check-runs read;
  4. missing credential (`credential-unavailable`/`config.credential.missing`);
  5. unresolved SHA (`commit-unresolved`);
  6. unresolved repository binding;
  7. torn park store (`state-unreadable`);
  8. missing provider chain (`provider-chain-not-declared`);
  9. missing PM context (`local-context-missing`);
  10. provider with an active park;
  11. credential-less/anonymous GitHub `ExternalSystemInstance` (`authMethod.mechanism: "anonymous"`) injected into the status composition, with a fixture transport that would answer a 2xx if read. This control is satisfiable through the spec F-12/DEC-5 composition guard and does not assume the client itself rejects anonymous auth; the guard withholds only the GitHub reads, so the per-section expectation is pinned in step 6 (tracker `unknown`, CI `unknown`, changes-and-prs `degraded` while the active change is observed).
- A fully-observed baseline and a credential-reference-instance restored control for the anonymous case.

**Steps**:

1. For each control, run status and assert the affected section state is `unknown`/`degraded`/`unavailable` (never `observed` with zero), the specific reason is present, and the item/evidence is truthful.
2. Assert no control yields a `clear`, `green`, `available`, `succeeded`, or "nothing to do" claim: scan the serialized digest and human text for the forbidden tokens and the section's result/availability.
3. Assert the queue section remains `not-delivered` in every control and the digest still has all six sections.
4. Assert the active-park control marks the entry `parked` (not `available`) and the missing-chain control is `unavailable` (not empty observed).
5. Assert the torn park store is `degraded`/`unknown` and never "no parks".
6. Anonymous control: assert the composition refuses the anonymous instance before any read (zero transport requests) and pin the per-section outcome — `tracker` `unknown` with `credential-unavailable`, `ci` `unknown` with `credential-unavailable`, and `changes-and-prs` `degraded` with `partial-evidence` (plus `credential-unavailable` on the refused PR read) while the local active change is `observed`; `changes-and-prs` is `unknown`/`unavailable` only when the fixture makes the active-change source absent or unusable. No affected section is `observed`; the refusal is the composition guard, not a client-level rejection.
7. For every control, run the restored fixture and assert the section reaches its expected outcome, proving the negative is not vacuous. For the anonymous case restored with the credential-reference instance, pin the normal Appendix A states: `tracker` and `ci` `observed`; `changes-and-prs` `degraded` on the GitHub slice because review state/threads are unavailable unless the fixture explicitly declares them available (then `observed`).
8. Assert every control's reason is drawn from the closed set and every failure class is an adapter-local class, not an error-table identity; assert `provider.chain.invalid` is never used as a `failureCode` or `failureClass` in the provider-config controls.
9. Cross-check the matrix coverage against the named controls (the ten AC-F9-1 controls plus the anonymous composition control) and fail if any is missing (a meta-assertion in the fixture builder).

**Expected Outcome**:

- Every named failure/absence/credential/state/park control is reflected in a non-observed state and a reason; none becomes an observed-zero, clear, green, or available claim. An anonymous/credential-less instance is refused before any read, with `tracker` and `ci` `unknown` and `changes-and-prs` `degraded` while the local active change is observed (`unknown`/`unavailable` only when the active-change source is also unusable), and no affected section is `observed`. The queue stays `not-delivered`; restored controls pass, with the credential-reference restored control returning `tracker`/`ci` `observed` and `changes-and-prs` `degraded` on the GitHub slice (or `observed` only when the fixture declares the review signals available).

#### TC-STATUS-024 - Read-only execution: zero writes/fences/mutations/network writes/spawns

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F1-2, AC-F7-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-readonly-determinism.test.ts`, `tests/fixtures/state/harness.ts`, `tests/behaviour/verify-support.ts`
**Tags**: @backend

**Preconditions**:

- A guarded state store wrapping a real temp store: records `read`; throws on `append`/`replaceDocument`/`acquireFence`/`releaseFence`.
- A recording transport that throws on non-`GET` and on unfixtured URLs.
- A child-process sentinel (a module-level spy/guard) and an AST scan of status modules for `node:child_process`.
- A temp PM-context file whose mtime/bytes are captured before the run.

**Steps**:

1. Run a fully-observed status; assert the store recorder saw `read` (proving the seam is live) and no mutation/fence call.
2. Assert the transport recorded only `GET` requests to the three declared endpoints; assert zero `POST`/`PUT`/`PATCH`/`DELETE`; assert zero requests for quota/announcements.
3. Assert the PM-context file bytes and mtime are unchanged; assert no file is created under the temp root's state/documents directory beyond the pre-existing fixtures.
4. Assert no child process is spawned (sentinel count `0`); assert no status module imports `node:child_process` (AST).
5. Assert no network write path exists in the status composition (no `write`/`append`/`replaceDocument`/`Fence` calls; grep/AST).
6. Seeded controls: a test that deliberately appends to the store trips the guard; a deliberate `POST` trips the transport; a deliberate spawn trips the sentinel. Each must fail, proving non-vacuity.
7. Assert `git status --porcelain` is unchanged for the live tree after the suite.

**Expected Outcome**:

- Status performs zero writes, fences, state mutations, network writes, and child processes; every seam is proven live by a seeded control.

#### TC-STATUS-025 - Determinism and byte-identical replay over identical inputs

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F1-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-readonly-determinism.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @golden

**Preconditions**:

- Fixed run id, fixed clock tick, synthetic brand, fixed streams.
- Fixtures across all six sections and the negative matrix; a cap-sized and a reversed-order twin.
- AST scan of the pure aggregator/renderer for `Date.now`, `Math.random`, `process.env`, `Bun.env`, `performance.now`.

**Steps**:

1. Run `--json` twice over identical injected inputs; assert byte-identical stdout (including whitespace/newline).
2. Run human mode twice; assert byte-identical stdout.
3. Run a fresh invocation with the same facts but new stream objects; assert identical bytes.
4. Run the reversed-order twin and assert the digest item order/counts are identical; assert the only differences permitted are those driven by a changed input fact.
5. Change one controllable fact (e.g., one item's `updatedAt`) and assert the digest changes in the expected bounded field, proving the equality is live.
6. Assert the pure aggregator/renderer contain no clock/randomness/ambient reads (AST); assert the clock is injected and used only for `generatedAt`/ages.
7. Assert the human text is derived from the same digest (no second data path): compare the rendered state/counts to the JSON digest.

**Expected Outcome**:

- Identical injected inputs produce byte-identical machine and human output; ordering is input-order independent; no ambient clock/randomness enters the pure tiers.

#### TC-STATUS-026 - Tier, purity, runtime-API location, no new package/subpath

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-7
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/status-imports.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/cli-edge-seam.test.ts`
**Tags**: @backend

**Preconditions**:

- The delivered status modules: the contracts additions under `packages/core/src/contracts`, the pure aggregator/renderer under `packages/core/src/domain`, the command under `packages/cli/src/commands`, and the adapter extensions under `packages/adapters/src/{github,repo,file}`.
- The existing `verify-imports.test.ts` detectors (contracts data-only, domain pure, spawn/network import scan).

**Steps**:

1. Assert the status contracts module is data-only: only type/interface/import/export/`as const` declarations; no runtime import; no executable statement.
2. Assert the pure status domain module imports only `#contracts`/`#domain/*`/relative; no `node:*`/`bun:*`, no state/config/provider implementation import, no I/O call (`readFileSync`, `parseDocument`, `Date.now`, `Math.random`, `process.env`).
3. Assert the CLI command module imports only the contracts and the domain (plus local types); no direct adapter or state import; the composition happens at the edge.
4. Assert the adapter extensions live only in the already-admitted subpaths (`github`, `repo`, `file`); no new package, `package.json` subpath, or runtime-API location is added; `tests/structure/subpaths.test.ts` passes with the unchanged expected subpath set.
5. Assert the status modules are registered in `inventory.json` with the correct executable allowances; an unregistered or wrongly-allowlisted module fails.
6. Assert `tests/structure/cli-edge-seam.test.ts` sees `status` composed beside `config`/`lint`/`phase`/`provider`/`verify` with injected dependencies and the additive optional human renderer.
7. Negative controls: add a `node:fs` import to the domain, add a new `./status` subpath, and unregister a module; each mutation must fail by name; the unmutated control is green.

**Expected Outcome**:

- Status is data/domain pure at the core tiers, I/O stays in the admitted adapter subpaths and CLI edge, and no package/subpath/runtime-API location is added.

#### TC-STATUS-027 - Secret-read allowlist four, no product literals, live-smoke literal test-only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-7, NFR-10
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/structure/status-imports.test.ts`, `tests/fixtures/status/literals/**`
**Tags**: @backend @security

**Preconditions**:

- `SECRET_READ_ALLOWLIST` (four entries) and the forbidden-literal registry (`packages/**` and registered `doc/**`; `tests/**` excluded).
- The live-smoke harness under `tests/behaviour/status-live.test.ts` and any brand-derivation helper.

**Steps**:

1. Assert `SECRET_READ_ALLOWLIST` length is exactly `4`; assert no status file (contracts/domain/command/adapters) appears in the allowlist; assert status source contains no ambient env read (`process.env`/`Bun.env`/`globalThis[...]`).
2. Assert the forbidden-literal scan over `packages/**` and registered `doc/**` reports zero `ados`/`ADOS_`/`~/.ados` violations; assert the status source has no product literal.
3. Assert the human header uses the injected brand `binaryName` (the synthetic brand) and never a hardcoded product.
4. Assert `ADOS_STATUS_LIVE` (or the brand-derived equivalent) appears only under `tests/**`; if a production edge exposes it, assert it is constructed from `brand.environmentPrefix` and the literal is absent from `packages/**` (spec v1.3 F-16, Appendix G, AC-F16-1).
5. Assert the secret-read allowlist mutation control (add a status file) fails; assert the forbidden-literal mutation control (add `ados` to a status source) fails.
6. Assert no secret canary appears in the digest/evidence/human text in the TC-006 fixture; assert the serialization redaction chokepoint is the only path.

**Expected Outcome**:

- The secret-read allowlist stays at four, status has no product literal or ambient env read, the human header is brand-derived, and the live-smoke literal is confined to tests (or brand-derived in production).

#### TC-STATUS-028 - Boundary, ambient, entrypoint, and inventory gates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-7
**Test Type(s)**: Structure, Boundaries
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`, `tests/structure/{subpaths,content-inventory}.test.ts`
**Tags**: @backend

**Preconditions**:

- The unchanged `.dependency-cruiser.cjs` rule set and the boundary fixture registry.
- The delivered status modules and the edge composition.

**Steps**:

1. Run `bun test tests/boundaries` and assert the boundary suite (including the fixture-coverage meta-check) passes with no new rule and no weakened rule.
2. Run `bun run scripts/checks/ambient-globals.ts` and assert the status modules are in the neutral-tier scope with zero ambient reads; assert a seeded ambient read fails.
3. Run `bun run scripts/checks/workspace-entrypoints.ts` and assert the declared `workspaceImports` edges are unchanged and the new modules import only declared edges; assert no undeclared package-name import.
4. Run `bun run scripts/checks/exit-code-literals.ts` and assert status chooses no exit code (the edge projects); assert no literal exit digit in the status modules.
5. Run `bun test tests/structure/subpaths.test.ts` and `bun test tests/structure/content-inventory.test.ts`; assert the subpath set and inventory are current.
6. Negative controls: add a forbidden edge/ambient read/exit literal/unregistered module; each must fail by name; the unmutated control is green.

**Expected Outcome**:

- The boundary, ambient, entrypoint, exit-literal, subpath, and inventory gates are green with no new rule or weakened rule; every gate has a failing fixture.

#### TC-STATUS-029 - Error-table stability and evidence code/class discipline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, DM-4, AC-F15-1, NFR-8
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/fixtures/result/code-corpora`
**Tags**: @backend

**Preconditions**:

- The delivered `ERROR_TABLE`/`DOMAIN_KINDS` and the documented result-contract table.
- A baseline snapshot of the pre-change rows/kinds.
- Status evidence fixtures with `failureCode` (`config.credential.missing`, `state.unreadable`, etc.) and `failureClass` (`provider.payload.invalid`).
- Provider-config identity fixtures from spec v1.3/v1.4 F-15/DM-4/DM-9: (a) a provider chain/config validation failure (`failureCode: "config.value.invalid"`, reason `provider-chain-unresolved`, no `failureClass`); (b) a config-resolution failure (reason `config-invalid` with the relevant existing `config.*` code, no `failureClass`).

**Steps**:

1. Assert `DOMAIN_KINDS` is unchanged (six kinds) and `ERROR_TABLE` has no new row; assert the documented table is unchanged and `error-table-sync` reports zero failures in both directions.
2. Assert every status evidence `failureCode` is an existing `config.*`/`state.*` code present in `ERROR_TABLE`; assert no `failureCode` is a status-specific or unknown code.
3. Assert the pinned provider-config identity: fixture (a) carries `failureCode: "config.value.invalid"`, reason `provider-chain-unresolved`, and **no** `failureClass`; fixture (b) carries reason `config-invalid` and the relevant existing `config.*` code, with no `failureClass`; assert the error-table row `provider.chain.invalid` is never used as a `failureCode` or `failureClass` anywhere in status evidence or the digest.
4. Assert every `failureClass` is an adapter-local class string and is **not** an `ERROR_TABLE` code/identity (e.g., `provider.payload.invalid`).
5. Assert the status command failures use only `fallback.invocation` (parser) and `fallback.internal` (containment); assert no `status.*` identity exists in the code or docs.
6. Assert existing classification tests remain green; assert the mutation controls (add a row, remove a row, change a code) still fail.
7. Assert the error-table sync check is read-only (git status unchanged).

**Expected Outcome**:

- No new error row or domain kind is added; section evidence uses existing codes or adapter-local classes; the exact provider-config pin (`config.value.invalid` + `provider-chain-unresolved` + no `failureClass`; `config-invalid` + `config.*` for a config-resolution failure) holds and `provider.chain.invalid` is never an evidence identity; the two-way sync and classification tests stay green.

#### TC-STATUS-030 - Committed fixture corpus drives all six sections with zero live calls

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-corpus.test.ts`, `tests/fixtures/status/corpus/**`
**Tags**: @backend @golden

**Preconditions**:

- A committed corpus under `tests/fixtures/status/corpus/*/case.json` where each case declares the injected facts and expected digest facts (section states, reasons, counts, ordered item ids, `truncated`).
- A throwing `fetch` guard / transport that fails on any live call.
- The fixture-harness builder that asserts each case's intended precondition.

**Steps**:

1. Assert the corpus covers every section, every state (except lanes' non-`not-delivered` states), every transition edge, and every negative control named in AC-F9-1; fail if a named class has no case.
2. For each case, build the injected facts, run the aggregator, and assert the expected section states/reasons/counts/ordered item ids/`truncated`.
3. Assert zero live network calls: the throwing guard is installed and never triggered; the transport records zero requests on corpus-only cases.
4. Assert the corpus cases are deterministic: run each twice and compare bytes.
5. Mutation controls: corrupt one expected state in a temp copy and assert the suite fails; remove a case and assert the coverage meta-check fails.
6. Assert the corpus is read-only: no case writes the live tree; `git status --porcelain` is unchanged.

**Expected Outcome**:

- The committed fixture corpus produces the expected six sections, states, evidence, ordering, caps, and negative controls with zero live calls, and its completeness is meta-checked.

#### TC-STATUS-031 - Golden full-digest snapshot and bounds over the corpus

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-16, DM-1, DM-13, AC-F16-1, NFR-2, NFR-5
**Test Type(s)**: Golden, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/status-digest.test.ts`, `tests/fixtures/status/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- A cap-sized corpus case with fixed run id (`run-status-fixture`), fixed clock (`2026-10-31T14:30:00Z`), synthetic brand.
- Committed golden `--json` digest and human text files.

**Steps**:

1. Run `--json status` on the fixed case; assert the serialized envelope (with the fixed run id/clock) equals the committed golden digest byte-for-byte.
2. Run human mode; assert the human text equals the committed golden human text byte-for-byte.
3. Assert the machine `data` is ≤ 65 536 bytes and the human text is ≤ 24 lines and ≤ 4096 bytes.
4. Assert the golden digest contains all six sections and no `error`; assert the human text has exactly six section lines.
5. Mutation controls: change one input fact (title length, item count, state) and assert the golden comparison fails; restore and assert it passes (the snapshot is live, not a no-op).
6. Assert the golden files are read-only at test time and no test rewrites them.

**Expected Outcome**:

- The full digest and human text are pinned byte-for-byte at a cap-sized fixture, within bounds, and the snapshot is proven live by a mutation control.

#### TC-STATUS-032 - Opt-in live smoke: structural only, no volatile counts, outside default CI

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-12, F-16, DEC-5, AC-F16-1, NFR-6, NFR-9
**Test Type(s)**: E2E, Manual
**Automation Level**: Semi-automated (opt-in)
**Target Layer / Location**: `tests/behaviour/status-live.test.ts` (skipped unless `ADOS_STATUS_LIVE=1` and a resolvable `GITHUB_TOKEN`)
**Tags**: @live @backend

**Preconditions**:

- `ADOS_STATUS_LIVE=1` and a resolvable `GITHUB_TOKEN` in the environment (supplied explicitly; never committed).
- The live smoke runs against this repository's `origin` and current HEAD.
- The default CI environment has neither the switch nor the credential.
- An explicit credential-less/anonymous control: the same live invocation with an `authMethod.mechanism: "anonymous"` GitHub `ExternalSystemInstance` injected (or the token deliberately suppressed for that case). The control is satisfiable through the spec F-12/DEC-5 composition guard and does not assume the live client rejects anonymous auth; the guard withholds only the GitHub reads, so the per-section expectation is pinned in step 8 (tracker `unknown`, CI `unknown`, changes-and-prs `degraded` while the active change is observed).

**Steps**:

1. Without the switch, run the suite and assert it is skipped/not executed and makes zero live calls (the `fetch` guard proves it).
2. With the switch and credential, run `status --json` against the repository.
3. Assert structural invariants only: exactly six sections in fixed order, non-empty evidence on every section, `truncated`/counts present, machine ≤ 64 KiB, human ≤ 24 lines/4096 bytes.
4. Assert `lanes-or-queue` is `not-delivered`; assert no provider entry is `available`; assert no section is observed-with-zero after a failed read; assert no secret/credential/raw payload appears.
5. Assert no volatile count is pinned (the assertions read structural properties, not exact issue/PR/CI counts); assert the run is tolerant of the repository's real (possibly empty) data.
6. Assert the live smoke is not part of `pnpm check` or default CI; assert the optional evidence artifact is bounded, secret-free, and not committed by default.
7. Negative control: an injected failure (e.g., missing credential) in the live path yields `unknown` sections, not an all-clear; the structural assertions still pass on the failure shape.
8. Anonymous/credential-less control: run the live suite with the anonymous instance injected (token suppressed for the case) and assert the composition refuses it before any live read (zero live requests) and pin the per-section outcome — `tracker` `unknown` with `credential-unavailable`, `ci` `unknown` with `credential-unavailable`, and `changes-and-prs` `degraded` with `partial-evidence` (plus `credential-unavailable` on the refused PR read) while the local active change is `observed`; `changes-and-prs` is `unknown`/`unavailable` only when the active-change source is itself absent or unusable. No affected section is `observed`; the refusal is the composition guard, not the live client rejecting anonymous auth.
9. Restored control: with the credential-reference instance restored, the structural assertions reach the expected live (possibly empty) shape, proving the anonymous control is not vacuous. Pin the normal Appendix A states: `tracker` and `ci` `observed`; `changes-and-prs` `degraded` on this repository's GitHub slice because review state/threads are unavailable.

**Expected Outcome**:

- The opt-in live smoke proves the six-section structural contract against the real repository without pinning volatile counts or running in default CI. An anonymous/credential-less instance is refused at composition before any live read; the guard withholds only the GitHub reads, so `tracker` and `ci` are `unknown` and `changes-and-prs` is `degraded` while the local active change is observed (`unknown`/`unavailable` only when the active-change source is also unusable), and no affected section is `observed`. The credential-reference restored control returns `tracker`/`ci` `observed` and `changes-and-prs` `degraded` on the GitHub slice. Default CI has zero live calls.

#### TC-STATUS-033 - Performance and read-cost bounds (NFR-9)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-9
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-performance.test.ts`, `tests/fixtures/status/bounds/cap-sized/**`
**Tags**: @backend @perf

**Preconditions**:

- A cap-sized corpus case (8 items per section/family) with a 100-item issues page, a 100-item PR page, and a 20-run check-runs page returned by one request at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), plus a fully-observed facts set.
- Counting seams: transport request recorder (per URL/method), state-store `read` recorder, config-resolver recorder, and a provider-engine/quota counter.
- A monotonic clock (`performance.now`) around the pure aggregator only; a warm-up run.

**Steps**:

1. Run the full status once and assert exactly three network reads: one issues page at `per_page=STATUS_SOURCE_ITEM_LIMIT`, one PR page at `per_page=STATUS_SOURCE_ITEM_LIMIT`, and one check-runs read at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20); assert no duplicate URL and no second page/retry request (a second request throws).
2. Assert the check-runs read is exactly one bounded page, reports the raw page size (20) with the runs, and derives the at-limit/`source-truncated` input from that raw size with no pagination.
3. Assert exactly one logical park-fold invocation (`readProviderParkViews`; the fold's documented internal verified reads are not multiplied by status) and `<= 1` config resolve; assert zero provider-engine `resolve`/`quota` calls and zero quota HTTP requests.
4. Assert no retry/loop: the transport recorder shows one attempt per read; an unfixtured second URL throws; assert no `while`/recursive pagination call site re-invokes a read (AST scan plus runtime call count).
5. Measure the pure aggregator over the cap-sized facts: warm up once, then take the median of five runs and assert the median `<= 50 ms`; record the measured value in the test output.
6. Assert the measurement is live: a deliberately expensive control (e.g., a full sort over an unbounded temporary list) exceeds the bound or is rejected by the cap scan, proving the timing assertion is not vacuous.
7. Assert a run with an unavailable repository binding makes zero network reads (short-circuit) and still returns six sections.
8. Record the measurement environment (runtime version, machine class) alongside the result; §8.3 OQ-T8 notes the CI-tolerance question without weakening the 50 ms spec bound.

**Expected Outcome**:

- Status uses at most three network reads (each one bounded page, with the check-runs page at `per_page=20` and its raw size driving the at-limit input), one logical park-fold read (`readProviderParkViews` invocation; internal verified reads not multiplied), and one config resolve; the pure aggregator completes within 50 ms on cap-sized inputs; there are no retry or pagination loops.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All status suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, corpus, golden, and aggregate gates |
| Temp fixture roots | `mkdtemp` under the OS temp directory | PM-context, state-park, repository, and mutation fixtures never write the live tree |
| Opt-in live environment | `ADOS_STATUS_LIVE=1` plus a resolvable `GITHUB_TOKEN` | Not part of `pnpm check` or default CI; structural assertions only |
| In-process test process | Bun runtime; injected brand, clock, run id, sources, state, and streams | No child processes for any status suite; fixed output facts for byte assertions |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Matrix fixtures | `tests/fixtures/status/matrix/**`: one case per Appendix A cell plus item-level-unknown twins | Read-only; builder asserts each intended fact |
| Tracker fixtures | `tests/fixtures/status/tracker/**` (normalized `WorkItem` sets) plus reused `tests/fixtures/providers/jira/{stalls,tracker-queries,comments-omitted,custom-fields}.json` and `tests/fixtures/providers/github/issues.json` | Read-only; reversals built in memory |
| Changes/PM-context fixtures | `tests/fixtures/status/changes/**`, `tests/fixtures/status/pm-context/*.yaml` (absent, empty, observed, malformed, wrong shape, entry-without-ref, notes, invalid `parkedAt`) | Read-only or temp-root materialized; no live PM-context write |
| CI fixtures | `tests/fixtures/status/ci/**` and reused `tests/fixtures/providers/github/check-runs-per-sha.json` | Read-only |
| Provider fixtures | `tests/fixtures/status/providers/*.json` (config snapshots) and verified park ledgers built with `tests/fixtures/state/harness.ts` | Read-only config; park ledgers in temp roots |
| Repository fixtures | `tests/fixtures/status/repository/*.json` (URL strings) and temp git-shaped `.git/config`/`HEAD` directories | Read-only URL strings; temp dirs for the adapter read |
| Bounds fixtures | `tests/fixtures/status/bounds/{under-cap,at-cap,over-cap,cap-sized,at-limit}/**` | Read-only; reversed twins built in memory |
| Negative-control fixtures | `tests/fixtures/status/negative-controls/cases.ts` (the ten AC-F9-1 controls plus restored controls) | Read-only case definitions |
| Corpus fixtures | `tests/fixtures/status/corpus/*/case.json` (facts + expected digest facts) | Read-only; completeness meta-checked |
| Golden fixtures | `tests/fixtures/status/golden/{digest.json,human.txt}` at fixed run id/clock | Read-only; mutations only in temp copies |
| Provider trap fixtures | `tests/fixtures/providers/traps/github.traps.json` plus `tests/fixtures/providers/github/**` | Read-only; extended with four entries |
| Error table | `ERROR_TABLE`, `DOMAIN_KINDS`, and the documented table in `doc/spec/features/feature-result-contract.md` | Read-only at test time; drift fails sync; mutation copies only |
| Baseline oracles | Pre-change error rows/kinds, Appendix C constants, and Appendix A cells held in the test files | Read-only; the only permitted change is the additive status surface |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation test uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, the real local PM context, or the user's real state directory. A clean-tree assertion after the suite is part of the aggregate gate.
- Status suites inject brand, paths, clock, run id, source facts, state store, transport, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- The real `origin`/HEAD is read only by the opt-in live smoke; the default suite uses injected repository facts and temp git-shaped dirs.
- State park fixtures are built from verified bytes with the real state harness and mutated by a named operation; a detection-disabled control must expose the planted value, proving the fixture is live.
- Corpus and golden fixtures are read-only at test time; corruption/mutation controls run on in-memory values or temp copies, and the unmutated control runs in the same suite.
- The extended trap catalog and the capability/operation-set baselines are read-only; mutations run on deep copies.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except TC-STATUS-032, which is opt-in automated. Locations follow the spec's affected-components table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, states, reasons, bounds, assertions, and AC/NFR mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-STATUS-001 | `tests/behaviour/status-command.test.ts` + `tests/fixtures/status/harness.ts` | `bun test tests/behaviour/status-command.test.ts` | parser rejection, zero-read recorder, write-free handler, valid control | To Implement |
| TC-STATUS-002 | same + non-observed fixture | same | reachable binding-observed fixture with six non-observed sections (2 `unknown`, 1 `degraded`, 2 `unavailable`, 1 `not-delivered`); dropped-section/malformed-envelope controls; throwing-handler containment | To Implement |
| TC-STATUS-003 | `tests/behaviour/status-section-states.test.ts` + `tests/fixtures/status/matrix/**` | `bun test tests/behaviour/status-section-states.test.ts` | per-section shape; remove-section/rename-state/drop-truncated controls; native-key scan | To Implement |
| TC-STATUS-004 | same + matrix fixtures | same | one case per Appendix A cell; item-unknown twins; flip-read controls | To Implement |
| TC-STATUS-005 | `tests/behaviour/status-output.test.ts` + `tests/fixtures/status/bounds/**` | `bun test tests/behaviour/status-output.test.ts` | exact envelope/data keys; 64 KiB; over-limit control; secret/native scan | To Implement |
| TC-STATUS-006 | same + human fixtures | same | six-line grammar; 24/4096 bounds; title/notes/secret canaries; read-count parity | To Implement |
| TC-STATUS-007 | same + bounds fixtures | same | under/at/over-cap and source-at-limit; check-runs `per_page=20` with 19/20 raw-page at-limit; reversed twins; tracker exact ranks; non-tracker permutation invariance | To Implement |
| TC-STATUS-008 | `tests/structure/status-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/status-contract.test.ts` | constant/vocabulary binding; in-memory mutation controls; inventory registration | To Implement |
| TC-STATUS-009 | `tests/behaviour/status-tracker.test.ts` + tracker fixtures | `bun test tests/behaviour/status-tracker.test.ts` | label predicate; absent-assignee; case-insensitive; closed-item; reversal; label-removal control | To Implement |
| TC-STATUS-010 | same + Jira fixtures | same | GitHub unavailable vs observed-empty; done/canceled/open/unobserved targets; source declaration controls | To Implement |
| TC-STATUS-011 | same + stall fixtures | same | older/at/fresh/absent/invalid; injected-clock advance; comments-only control; wall-clock control | To Implement |
| TC-STATUS-012 | same + comment/custom-field fixtures | same | title/label findings; comment/custom-field no-op; mapped-field mutation | To Implement |
| TC-STATUS-013 | `tests/behaviour/status-changes-ci.test.ts` + changes fixtures | `bun test tests/behaviour/status-changes-ci.test.ts` | active observed/empty/absent/malformed; review unavailable vs available-item-unknown; partial failure degraded | To Implement |
| TC-STATUS-014 | same + CI fixtures | same | one bounded check-runs page at `per_page=20`; failed/pending/canceled/succeeded/none/all-skipped; precedence controls; none-not-green | To Implement |
| TC-STATUS-015 | same + CI failure fixtures | same | unresolved SHA, missing HEAD, failed read, credential, no binding; restored controls; one-attempt no-retry | To Implement |
| TC-STATUS-016 | `tests/behaviour/status-providers-parked.test.ts` | `bun test tests/behaviour/status-providers-parked.test.ts` | always not-delivered; zero queue read; observed-empty/queue-ready controls | To Implement |
| TC-STATUS-017 | same + `tests/fixtures/status/providers/**` + state harness | same | declared/parked/chain-parked/no-chain/unresolved/config-invalid/park-failure; `config.value.invalid` + `provider-chain-unresolved` + no class; expiry T−1/T/T+1; caps | To Implement |
| TC-STATUS-018 | same + `status-readonly-determinism.test.ts` | corresponding `bun test` | counting engine/quota stubs; guarded store; deliberate-call controls | To Implement |
| TC-STATUS-019 | same + PM-context fixtures | same | observed/empty/absent/malformed/wrong-shape; item-unknown; age only from `parkedAt`; notes canary | To Implement |
| TC-STATUS-020 | `tests/behaviour/status-repository.test.ts` + repository fixtures | `bun test tests/behaviour/status-repository.test.ts` | HTTPS/SSH/userinfo/no-origin/unparseable/non-GitHub; downstream propagation; no-spawn; linked worktree | To Implement |
| TC-STATUS-021 | `tests/behaviour/providers/github-collection.test.ts` (read-side steps 1–6, 8) + `tests/behaviour/status-command.test.ts` (composition guard/restored control, steps 7, 9) + GitHub fixtures | `bun test tests/behaviour/providers/github-collection.test.ts`; `bun test tests/behaviour/status-command.test.ts` | mixed page PR exclusion; page limit; absent relations; review-default not trusted; native-key/credential controls; anonymous-instance refused before read with tracker/CI `unknown` and changes-and-prs `degraded` while the active change is observed (never `observed`); restored control tracker/CI `observed`, changes-and-prs `degraded` on the GitHub slice | To Implement |
| TC-STATUS-022 | `tests/structure/trap-catalog.test.ts`, `provider-surface.test.ts`, `port-contract-inventory.test.ts` | corresponding `bun test` | unchanged operation set/capability; four-field entries; bidirectional coverage; deletion controls | Existing – Update |
| TC-STATUS-023 | `tests/behaviour/status-negative-controls.test.ts` + cases | `bun test tests/behaviour/status-negative-controls.test.ts` | ten AC-F9-1 controls + anonymous composition control; per-section guard pin (tracker/CI `unknown`, changes-and-prs `degraded` while active change observed, never `observed`); no-clear scan; queue retained; restored controls (credential-reference: tracker/CI `observed`, changes-and-prs `degraded` unless review signals declared available); matrix meta-check | To Implement |
| TC-STATUS-024 | `tests/behaviour/status-readonly-determinism.test.ts` + state harness + verify-support | `bun test tests/behaviour/status-readonly-determinism.test.ts` | guarded store; transport method/URL; PM-context bytes; spawn sentinel; seeded controls | To Implement |
| TC-STATUS-025 | same + `tests/golden/helpers.ts` | same | byte-identical replays; reversed twin; changed-fact control; AST purity scan | To Implement |
| TC-STATUS-026 | `tests/structure/status-imports.test.ts`, `subpaths.test.ts`, `content-inventory.test.ts`, `cli-edge-seam.test.ts` | corresponding `bun test` | contracts data-only, domain purity, adapter-subpath confinement, inventory, edge composition; seeded violations | To Implement (new suite) + Existing – Update |
| TC-STATUS-027 | `tests/checks/secret-read-boundary.test.ts`, `forbidden-literals.test.ts`, `status-imports.test.ts` | corresponding `bun test` | allowlist length 4; no status file; no product literal; brand-derived header; test-only live literal; seeded violations | Existing – Update |
| TC-STATUS-028 | `tests/boundaries/**`, `scripts/checks/*.ts`, subpaths/inventory suites | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` | existing negative fixtures; seeded violations; rule baseline diff; fixture-coverage meta-check | Existing – Update |
| TC-STATUS-029 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/structure/error-table.test.ts` | no new row/kind; evidence code subset; class-not-identity; exact provider-config pin; both drift directions; read-only | Existing – Update |
| TC-STATUS-030 | `tests/behaviour/status-corpus.test.ts` + corpus | `bun test tests/behaviour/status-corpus.test.ts` | corpus completeness; expected states/order/caps; zero-live guard; corruption/removal controls | To Implement |
| TC-STATUS-031 | `tests/golden/status-digest.test.ts` + golden | `bun test tests/golden/status-digest.test.ts` | byte-for-byte digest + human; bounds; changed-fact control; read-only golden | To Implement |
| TC-STATUS-032 | `tests/behaviour/status-live.test.ts` | `ADOS_STATUS_LIVE=1 bun test tests/behaviour/status-live.test.ts` | skipped-without-switch; structural-only assertions; no volatile counts; failure-shape control; anonymous-instance refusal with tracker/CI `unknown` and changes-and-prs `degraded` while the active change is observed (never `observed`); restored control tracker/CI `observed`, changes-and-prs `degraded` | To Implement (opt-in) |
| TC-STATUS-033 | `tests/behaviour/status-performance.test.ts` + cap-sized fixtures | `bun test tests/behaviour/status-performance.test.ts` | read counters; check-runs `per_page=20`/raw-size; one-attempt/no-loop; median ≤50 ms; unavailable-binding zero-read; live-control | To Implement |

**Execution order.**

1. Contracts, constants, and error-table/boundary baselines: TC-STATUS-008, TC-STATUS-022, TC-STATUS-026, TC-STATUS-027, TC-STATUS-028, TC-STATUS-029.
2. Command surface and totality: TC-STATUS-001, TC-STATUS-002, TC-STATUS-003, and TC-STATUS-021's composition guard/restored control (Phase 4 `status-command.test.ts` harness).
3. State derivation and evidence: TC-STATUS-004, TC-STATUS-023.
4. Tracker families: TC-STATUS-009, TC-STATUS-010, TC-STATUS-011, TC-STATUS-012.
5. Changes/CI/lanes: TC-STATUS-013, TC-STATUS-014, TC-STATUS-015, TC-STATUS-016.
6. Providers/parked/repository: TC-STATUS-017, TC-STATUS-018, TC-STATUS-019, TC-STATUS-020.
7. GitHub collection reads: TC-STATUS-021 (read-side steps in `github-collection.test.ts`; the composition guard/restored control completes in the Phase 4 `status-command.test.ts` harness).
8. Output/bounds/determinism: TC-STATUS-005, TC-STATUS-006, TC-STATUS-007, TC-STATUS-024, TC-STATUS-025.
9. Corpus, golden, performance: TC-STATUS-030, TC-STATUS-031, TC-STATUS-033.
10. Opt-in live and aggregate: TC-STATUS-032; `pnpm check`; `git diff --check`; `git status --porcelain`.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suite is discovered by `bun test tests/structure`. The error-table sync check stays in the existing `ts-invariants` wiring. The boundary rules and the secret-read/forbidden-literal checks extend to the new modules automatically; no rule is added or weakened. The opt-in live smoke is intentionally outside `pnpm check` and default CI. Documentation reconciliation gates run in phase 7: `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, the error-table sync check for the unchanged result-contract table, forbidden-literal registration for the new current-truth feature doc that names the binary, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable guide or template.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/status-contract.test.ts
bun test tests/structure/status-imports.test.ts
bun test tests/structure/subpaths.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/structure/trap-catalog.test.ts
bun test tests/structure/provider-surface.test.ts
bun test tests/structure/cli-edge-seam.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/behaviour/status-command.test.ts
bun test tests/behaviour/status-section-states.test.ts
bun test tests/behaviour/status-output.test.ts
bun test tests/behaviour/status-tracker.test.ts
bun test tests/behaviour/status-changes-ci.test.ts
bun test tests/behaviour/status-providers-parked.test.ts
bun test tests/behaviour/status-repository.test.ts
bun test tests/behaviour/providers/github-collection.test.ts
bun test tests/behaviour/status-negative-controls.test.ts
bun test tests/behaviour/status-readonly-determinism.test.ts
bun test tests/behaviour/status-corpus.test.ts
bun test tests/golden/status-digest.test.ts
bun test tests/behaviour/status-performance.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
bash scripts/.tests/test-doc-distribution.sh
git diff --check
git status --porcelain
ADOS_STATUS_LIVE=1 bun test tests/behaviour/status-live.test.ts   # opt-in, credentialed, not default CI
```

**Open-PR DoD evidence checklist.** All 24 ACs have a passing traceable TC and all 10 NFRs are measured; the six sections and five states are total with non-empty evidence, counts, items, and truncation; the Appendix A matrix and the AC-F9-1 controls are exhaustive and non-vacuous with restored controls; tracker four families use labels-only owner hand-backs, unavailable GitHub blocked dependencies, `updatedAt`-absent unknown stalls, and title/label hygiene; changes/PRs keep review signals unknown and partial failure degraded; CI `none`/all-skipped are never green, unresolved/failed reads are unknown, and the check-runs read is one bounded `per_page=20` page whose raw size drives `source-truncated`; lanes is always `not-delivered` with no queue read; providers are `parked`/`unverified` only with zero engine/quota calls; parked work is truthful across absent/malformed/empty/observed with no notes and no fabricated age; repository binding is credential-free and truthful for HTTPS/SSH/absent/unparseable/non-GitHub; GitHub collection reads exclude PRs, stay one bounded page, and keep the capability/operation set unchanged with four new trap entries and bidirectional coverage; zero writes/fences/mutations/network-writes/spawns and byte-identical replays; the 64 KiB/24-line/4096-byte bounds are live; no new error row/kind, config key, state schema, package, subpath, runtime-API location, or secret-read entry; the fixture corpus and golden snapshot are deterministic with zero live calls; the live smoke is opt-in and structural; the new feature doc and reconciled docs are registered; a minor changeset is recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-12).** Every spec risk is exercised by at least one TC; the mapping is the forward trace from the spec.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — non-observed state read as "nothing to do" | TC-STATUS-003, TC-STATUS-004, TC-STATUS-006, TC-STATUS-023 |
| RSK-2 — active provider park reported as available | TC-STATUS-017, TC-STATUS-023 |
| RSK-3 — queue section mistaken for an empty queue | TC-STATUS-016, TC-STATUS-023 |
| RSK-4 — absent `updatedAt`/`assignee`/`comments` fabricated | TC-STATUS-009, TC-STATUS-011, TC-STATUS-012, TC-STATUS-023 |
| RSK-5 — network/credential/commit failure rendered green | TC-STATUS-015, TC-STATUS-023 |
| RSK-6 — GitHub list overclaims/duplicates/truncates silently | TC-STATUS-021, TC-STATUS-022 |
| RSK-7 — `origin` addressing fails in worktrees/non-GitHub | TC-STATUS-020 |
| RSK-8 — absent PM context becomes "no parked work" | TC-STATUS-019, TC-STATUS-023 |
| RSK-9 — unbounded digest defeats the token goal | TC-STATUS-005, TC-STATUS-006, TC-STATUS-007 |
| RSK-10 — credential/payload material leaks into evidence | TC-STATUS-005, TC-STATUS-006, TC-STATUS-027 |
| RSK-11 — status docs drift from delivered behavior | TC-STATUS-008, TC-STATUS-028, TC-STATUS-029 |
| RSK-12 — scope creep into queue/provider/GraphQL/full adapter | §1.2 non-goals; TC-STATUS-018, TC-STATUS-022, TC-STATUS-026 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A negative fixture is inert, so a false all-clear passes | H | M | Every negative/matrix/corpus case asserts the exact state/reason/counts/items and has a restored control (§4.2) |
| RSK-T2 | A "not observed" assertion is vacuous because the run failed elsewhere | H | M | One oracle per cell asserts state + reasons + counts + ordered items + truncation, plus a restored control reaches `observed` |
| RSK-T3 | Item-level unknown and section-unknown are collapsed | H | M | Every observed-section-with-item-unknown fixture is paired with a section-unknown fixture (TC-004) |
| RSK-T4 | Cap/truncation is asserted by sampling and misses an over-cap case | M | M | Under-cap, at-cap, over-cap, and source-at-limit fixtures run together; `omitted` and `truncated` are both asserted (TC-007) |
| RSK-T5 | Read-only proof is vacuous because a seam never fires | H | L | Every recorder/stub is proven live by a seeded deliberate call; a recorder that never observes a read fails (TC-018, TC-024) |
| RSK-T6 | Provider park fixtures do not exercise the real verified fold | H | M | Park views are built from verified bytes with the state harness; a detection-disabled control exposes the planted value (TC-017) |
| RSK-T7 | The live smoke becomes flaky or pins volatile counts | M | M | Live assertions are structural only; no counts pinned; the suite is opt-in and outside `pnpm check` (TC-032) |
| RSK-T8 | Timing assertion is flaky on slow CI | M | M | Measure the pure aggregator only, warm up, take a median, and record the environment; the 50 ms spec bound is not silently relaxed (OQ-T8) |
| RSK-T9 | The GitHub trap catalog is extended without bidirectional coverage | M | L | `trapCoverageFailures` and deletion controls fail by name (TC-022) |
| RSK-T10 | The status constants drift from Appendix C or the reason/source sets | M | L | TC-008 binds the constants/vocabularies and mutation-controls each; the phase-7 doc is reconciled separately, not silently substituted |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for section ids/order, states, reasons, sources, outcomes, bounds, schema version, and non-verdict semantics. Delivery planning may choose helper/file names but may not rebind a pinned value.
- **A-T2 — In-process harness.** Every status behaviour test uses `runCli` with injected dependencies and source readers; no status suite spawns a child process or reads the ambient environment/network in default CI.
- **A-T3 — Plan mapping.** GAP-1 resolved by the current implementation plan (v1.1 onward; currently v1.3) (`chg-GH-175-plan.md`), which maps all 33 TCs onto its delivery phases/tasks and must not reshape them; any later plan or implementation that alters a TC's behaviour, state, reason, or AC/NFR mapping reopens this test plan.
- **A-T4 — Delivery-bound spellings.** Contract export names, runtime type names, helper names, section `title` strings, human line labels, and header wording are delivery-bound (GAP-8). The vocabulary, order, caps, reasons, sources, outcomes, and schema version are pinned.
- **A-T5 — Tracker cap reading.** GAP-2/OQ-T1: spec v1.3 (DM-5, DM-12, Appendix C, Appendix D) fixes per-family 4 as the binding cap, no common list, and aggregate `truncated`/`omitted`. The test would also fail a single tracker list longer than 8.
- **A-T6 — Non-tracker rank keys.** GAP-3/OQ-T2: spec v1.3 §8.3 (rank-key table) and DM-12 fix the exact keys; the tests assert permutation invariance and a documented stable key, so order independence is proven without over-pinning a spelling.
- **A-T7 — Providers precedence.** GAP-4/OQ-T3: spec v1.3 (DM-9, Appendix A, §8.3) fixes `unknown` (config untrusted) → `unavailable` (no default chain) → `degraded` (park fold failed) → `observed`; the clear cells and the previously ambiguous combination are tested.
- **A-T8 — Machine bound unit.** GAP-7/OQ-T6: spec v1.3 (AC-F11-1, NFR-2, Appendix C) fixes the 64 KiB bound on the serialized `data`; the envelope total is recorded but not separately capped.
- **A-T9 — Live literal.** GAP-6/OQ-T5: spec v1.3 (F-16, Appendix G, AC-F16-1) fixes `ADOS_STATUS_LIVE` as test-only under `tests/**`; any production switch is derived from `brand.environmentPrefix`.
- **A-T10 — Corpus preconditions.** The committed fixture corpus is the deterministic oracle for default CI; a corpus change is a deliberate test-plan event, not a silent update.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Does `STATUS_MAX_ITEMS_PER_SECTION = 8` apply to the tracker section or does each family's 4 cap govern? | GAP-2. Spec v1.3 fixes per-family 4 + aggregate `truncated`/`omitted` (DM-5, DM-12, Appendix C, Appendix D). | Resolved by spec v1.3 — DM-5, DM-12, Appendix C, Appendix D | @spec-writer / @plan-writer |
| OQ-T2 | What are the exact deterministic rank keys for PRs, CI runs, provider entries/parks, and parked work? | GAP-3. Spec v1.3 §8.3 (rank-key table) and DM-12 enumerate the exact keys and tie-breakers; Appendix D points to them. | Resolved by spec v1.3 — §8.3 rank-key table, DM-12, Appendix D | @plan-writer / @coder |
| OQ-T3 | What is the providers precedence when the provider config has no default chain and the park fold also fails? | GAP-4. Spec v1.3 fixes `unknown` → `unavailable` → `degraded` → `observed` (DM-9, Appendix A, §8.3). | Resolved by spec v1.3 — DM-9, Appendix A, §8.3 | @spec-writer |
| OQ-T4 | Does `summary.actionable` count tracker family items, CI runs, and provider entries/parks? | GAP-5. Spec v1.3 fixes the exact definition as the rendered-`items` sum in observed/degraded sections (DM-1, Appendix B). | Resolved by spec v1.3 — DM-1, Appendix B | @spec-writer / @plan-writer |
| OQ-T5 | Is the live-smoke switch test-only or a production brand-derived switch? | GAP-6. Spec v1.3 fixes test-only under `tests/**`, with brand-derivation if production exposes it (F-16, Appendix G, AC-F16-1). | Resolved by spec v1.3 — F-16, Appendix G, AC-F16-1 | @plan-writer / @coder |
| OQ-T6 | Is the 64 KiB bound on `data` or on the whole envelope? | GAP-7. Spec v1.3 fixes the bound on serialized `data`; the envelope total is recorded only (AC-F11-1, NFR-2, Appendix C). | Resolved by spec v1.3 — AC-F11-1, NFR-2, Appendix C | @spec-writer |
| OQ-T7 | Does the source-at-limit signal use the raw page size when PR objects are filtered from the issues page, and does it apply to the check-runs read? | GAP-9. Spec v1.3 fixes the raw-page-derived signal for both the list reads and the check-runs read (F-10, DM-12, Appendix F, AC-F10-1); the nuances are recorded in TC-007. | Resolved by spec v1.3 — F-10, DM-12, Appendix F, AC-F10-1 | @spec-writer / @coder |
| OQ-T8 | What CI tolerance applies to the 50 ms pure-aggregation measurement? | RSK-T8. The plan measures the pure aggregator with a warm-up and median and records the environment; the spec bound is not silently relaxed. | Open — non-blocking | @plan-writer |

**Recorded gaps, not silently adjusted:**

1. **Implementation-plan mapping** — GAP-1/A-T3; resolved by the current implementation plan (v1.1 onward; currently v1.3), which maps all 33 TCs onto its phases and must not reshape them.
2. **Tracker cap interaction** — GAP-2/A-T5/OQ-T1; resolved by spec v1.3 (DM-5, DM-12, Appendix C, Appendix D); per-family 4 asserted, aggregate truncation asserted.
3. **Non-tracker rank keys** — GAP-3/A-T6/OQ-T2; resolved by spec v1.3 (§8.3 rank-key table, DM-12); permutation invariance and the pinned keys asserted.
4. **Providers precedence** — GAP-4/A-T7/OQ-T3; resolved by spec v1.3 (DM-9, Appendix A, §8.3); clear cells and the previously ambiguous combination tested.
5. **`summary.actionable`** — GAP-5/OQ-T4; resolved by spec v1.3 (DM-1, Appendix B); pinned definition asserted.
6. **Live-smoke literal** — GAP-6/A-T9/OQ-T5; resolved by spec v1.3 (F-16, Appendix G, AC-F16-1); test-only under `tests/**` or brand-derived.
7. **Machine bound unit** — GAP-7/A-T8/OQ-T6; resolved by spec v1.3 (AC-F11-1, NFR-2, Appendix C); `data` bound asserted.
8. **Delivery-bound spellings** — GAP-8/A-T4; pinned vocabulary only.
9. **Source-at-limit with filtered PRs and bounded check runs** — GAP-9/OQ-T7; resolved by spec v1.3 (F-10, DM-12, Appendix F, AC-F10-1); raw-page signal asserted for the list reads and the `per_page=20` check-runs page.

No AC and no NFR is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T14:30:00Z | Change Test Plan Writer | Initial plan: 33 TCs (TC-STATUS-001..033). All 24 ACs (AC-F1-1..AC-F16-1), all 10 NFRs, all 15 DMs, and all 12 spec risks mapped; six-section totality and the Appendix A matrix; tracker four families with ADR-0004/0006 absence discipline and GitHub blocked-dependency unavailability; changes/PRs unknown review signals; CI `none`-not-green and unresolved/failed reads; lanes always `not-delivered`; providers parked/unverified with zero engine/quota calls; parked work absent/malformed/empty/observed with no notes; origin HTTPS/SSH binding with credential stripping; bounded GitHub collection reads with unchanged capability and four new trap entries; the exhaustive AC-F9-1 matrix; zero writes/fences/mutations/network-writes/spawns; byte-identical replay; boundaries/tier/branding/secret-read gates; error-table stability; committed corpus + golden + opt-in structural live smoke; performance/read-cost bounds. Nine recorded gaps (implementation-plan mapping — since resolved by plan v1.1, tracker cap interaction, non-tracker rank keys, providers precedence, `actionable` semantic, live-smoke literal, machine bound unit, delivery-bound spellings, source-at-limit with filtered PRs) with chosen readings and open questions; no coverage silently weakened. |
| 1.1 | 2026-10-31T15:15:00Z | Change Test Plan Writer | Reconciliation with spec v1.1. §1.2 GAP-2..GAP-7 and GAP-9 marked resolved (pinned behavior prose retained); §8.3 OQ-T1..OQ-T7 closed as resolved by spec v1.1 with the canonical sections named (DM-1, DM-5, DM-9, DM-12, Appendix A/B/C/D/F, F-10, F-16, AC-F10-1, AC-F11-1, AC-F16-1, NFR-2, §8.3), while OQ-T8 (CI timing tolerance) remains the delivery-bound open question; §8.2 A-T5..A-T9 and the §8.3 recorded-gaps list now cite spec v1.1 as authority rather than a plan-local reading. TC-STATUS-007/TC-STATUS-027 references point at the pinned tables. No TC renumbered and no assertion, TC count, coverage, or behavior changed; the rank-key cross-check required no assertion update. |
| 1.2 | 2026-10-31T15:50:00Z | PM (planning reconciliation) | NFR-9/TC-STATUS-033 read-cost clarification driven by the implementation plan: the metric counts one **logical park-fold read** (one `readProviderParkViews` invocation); the fold's documented internal verified reads are not multiplied by status. No other assertion, TC count, coverage, or behavior changed. |
| 1.3 | 2026-10-31T16:20:00Z | Change Test Plan Writer | DoR iteration-1 closeout for the test_planning-routed findings. **TC-STATUS-002** rebuilt from a reachable fixture — binding `observed`; issues read failed → tracker `unknown`; PR read failed with the active change observed → changes/PRs `degraded`; check-runs read failed for the resolved checkout SHA → CI `unknown`; providers `unavailable` (no declared chain); parked `unavailable` (no PM context); lanes `not-delivered` — with the corrected summary `{sections: 6, observed: 0, degraded: 1, unknown: 2, unavailable: 2, notDelivered: 1, actionable: 0}`; the prior no-binding/CI-`unavailable` combination was unreachable through `runCli` and is removed. **TC-STATUS-007**, **TC-STATUS-033**, **TC-STATUS-014**, and **TC-STATUS-022** aligned to the spec v1.3 CI rule: the check-runs read is one bounded page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), no pagination, and the raw page size (19 vs 20 runs) drives the at-limit/`source-truncated` signal even though `STATUS_MAX_PIPELINE_RUNS` renders at most 8; the existing all-skipped/`none`-never-green assertions are unchanged, and `readPipelineRun` keeps its name with only the optional declared page limit and raw-page-size reporting. **GAP-1/A-T3** marked resolved by plan v1.1 (all 33 TCs mapped, none reshaped); all current spec references updated from v1.1 to v1.3, with the v1.1 revision-log row retained as history; `last_updated` bumped. No TC renumbered or added/removed; 33 TCs, 24 ACs, 10 NFRs, and 15 DMs remain covered. |
| 1.4 | 2026-10-31T17:10:00Z | Change Test Plan Writer | DoR iteration-2 closeout for the test_planning-routed findings. **TC-STATUS-017** and **TC-STATUS-029** now assert the spec v1.3/v1.4 provider-config identity pin: a chain/config validation failure carries `failureCode: "config.value.invalid"` + reason `provider-chain-unresolved` + no `failureClass`; a config-resolution failure carries reason `config-invalid` + the relevant existing `config.*` code; `provider.chain.invalid` is never a `failureCode` or `failureClass` (TC-017 gains a config-invalid case (g) and identity negative control; TC-029 gains the exact fixtures, step, and expected outcome; AC-F15-1 traceability updated). **TC-STATUS-021**, **TC-STATUS-023**, and **TC-STATUS-032** now carry an explicit credential-less/anonymous GitHub `ExternalSystemInstance` (`authMethod.mechanism: "anonymous"`) control: the composition guard refuses it before any read; tracker/changes/CI classify `unknown`/`unavailable` with `credential-unavailable`/`source-unavailable`, never `observed`; each control is satisfiable and does not assume the client rejects anonymous auth, with a credential-reference restored control (refined in v1.5: the guard withholds only the GitHub reads, so `changes-and-prs` is `degraded` while the active change is observed; `tracker`/`ci` remain `unknown`). **GAP-1/A-T3** citations updated to "the current implementation plan (v1.1 onward; currently v1.3)" while the historical v1.1 revision-log row is retained. `last_updated` bumped. No TC renumbered, added, or removed; 33 TCs, 24 ACs, 10 NFRs, and 15 DMs remain covered. |
| 1.5 | 2026-10-31T18:30:00Z | Change Test Plan Writer | DoR iteration-3 closeout for the test_planning-routed findings, aligned to spec v1.5 F-12/DEC-5/§6 flow 3. **R-1 (per-section guard states):** **TC-STATUS-021**, **TC-STATUS-023**, and **TC-STATUS-032** now pin the anonymous/credential-less guard per section: the guard withholds only the GitHub reads, so `tracker` is `unknown` (`credential-unavailable`), `ci` is `unknown` (`credential-unavailable`), and `changes-and-prs` is `degraded` (`partial-evidence`, with `credential-unavailable` on the refused PR read) while the local active change is observed; `changes-and-prs` is `unknown`/`unavailable` only when the active-change source is itself absent or unusable; no affected section is ever `observed`. The "restored control reaches `observed`" language is replaced with the normal Appendix A states: `tracker`/`ci` `observed`, and `changes-and-prs` `degraded` on the GitHub slice because review state/threads are unavailable (unless the fixture explicitly declares them available). Step 7/6/8 (TC-021/023/032 respectively), the restored-control steps, the expected outcomes, the preconditions, and the §7 automation rows carry the pin. **R-3 (AC-F12-1 row):** the §3.1 AC-F12-1 traceability row no longer carries the anonymous-guard clause (it is not in spec AC-F12-1); the row is focused on repository binding, and the guard is traced to F-12/DEC-5 in the capability-coverage line and in the TC related IDs. **R-4 (TC-021 location):** TC-STATUS-021's Target Layer / Location and the §7 automation row now name the two-file split matching plan Phase 4 — read-side steps in `tests/behaviour/providers/github-collection.test.ts` and the composition guard/restored control in `tests/behaviour/status-command.test.ts` — and §4/§7 execution order note the split. No TC renumbered, added, or removed and no assertion weakened; 33 TCs, 24 ACs, 10 NFRs, and 15 DMs remain covered; `last_updated` bumped. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
