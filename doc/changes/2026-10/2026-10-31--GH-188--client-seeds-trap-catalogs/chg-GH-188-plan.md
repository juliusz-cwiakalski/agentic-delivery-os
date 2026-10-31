---
id: chg-GH-188-client-seeds-trap-catalogs
status: Proposed
created: 2026-10-31T14:30:00Z
last_updated: 2026-10-31T15:00:00Z
owners: [engineering]
service: delivery-os provider adapters
labels: [change, planning]
links:
  change_spec: ./chg-GH-188-spec.md
  test_plan: ./chg-GH-188-test-plan.md
  pm_notes: ./chg-GH-188-pm-notes.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
  adr_refs:
    - ../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md
    - ../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md
    - ../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md
  related_changes:
    - ../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-plan.md
summary: >
  Seed the first three provider clients behind the delivered primitive ports —
  a Jira read slice (feeding the M0-S6 tracker collector), a GitLab client
  (MRs, pipelines per commit, merge-status quirks), and a minimal GitHub read
  slice (PRs, check runs, issues) — each with an honest capability declaration,
  a fixture-proven offline trap catalog, credential resolution exclusively
  through the credential port, the additive WorkItem contract extensions
  (optional updatedAt; optional comments), and the reviewed runtime-API
  confinement admission for provider client subpaths.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-188: M0-S19: Client seeds with trap catalogs

## Context and Goals

Implement F-1–F-8 of the completed specification (v1.3; 12 ACs in §17, DEC-1–DEC-8 in §15, DM-1–DM-8 in §8.3, §18 DoD predicates) against the completed test plan (v1.2; 28 TCs). Both artifacts are committed; this plan derives every task, file location, and gate from them and adds no requirement. Execution belongs on `feat/GH-188/client-seeds-trap-catalogs`; the PR targets `main-tools`.

**Settled inputs — the plan does NOT re-do them:**

- **Implementation-basis evaluations are complete** (ticket GH-188 decision comment 6536692124; PM notes): GitHub + GitLab = **direct REST via native `fetch`** (provider CLIs disqualified: own token caches, subprocess output drift); Jira = **custom minimal read-slice client** (no official TS client; `jira.js` MIT viable but unused surface; MCP clients need host+creds outside the credential port; re-evaluation fallback trigger at M0-S14 write ops). **Zero new dependencies** — the license registry is unchanged. These are inputs to P3–P5, not tasks; TC-PLAN-001 is verify-only evidence in P10.
- **ADR-0004** (optional `WorkItem.updatedAt`, ISO-8601 UTC, absent = activity unknown), **ADR-0005** (runtime-confinement admission for `github|gitlab|jira` provider client subpaths, reason-bearing, `registry` stays non-I/O; secret-read allowlist untouched at exactly 4 entries), **ADR-0006** (custom fields = documented mapping semantics, no contract change; `WorkItem.comments` becomes optional, absent = comment set unknown) are recorded and govern P1–P3.
- **Spec §18 build order** governs phase order: contract extensions first, then the confinement admission, then Jira (feeds M0-S6), then GitLab, then GitHub, then the trap suites' cross-client discipline, then capability wiring evidence, then gates.

**Code-reality facts this plan relies on** (verified 2026-10-31): the provider subpaths `packages/adapters/src/{github,gitlab,jira}/` exist as type-only placeholders and are **already registered** everywhere (adapters `exports` + `#github/*`-style `imports` aliases, `tests/boundaries/harness.ts` ADAPTER_SUBPATHS, `tests/structure/subpaths.test.ts`, `scripts/checks/workspace-entrypoints.ts`) — no manifest/registration work is needed. `runtime-apis-confinement` currently allows only `^packages/adapters/src/(repo|file|host|session|legacy|credentials)/` plus state-driver/cli/opencode. The ambient-globals guard bans `fetch` only in core neutral tiers (not adapters). `SECRET_READ_ALLOWLIST` in `scripts/checks/secret-read-boundary.ts` holds exactly 4 entries and **must not change**. `pnpm check` = lint → format:check → typecheck → test → check:boundaries → exports-parity, with `pretest`/`pretypecheck` building first.

### Decisions this plan records (test-plan §8.3 items owned by the plan writer)

- **OQ-C — trap-entry granularity and minima**: confirm the variant split. Catalogs ship **11 entries**: GitLab 3 (`GL-PIPELINE-MULTIPLICITY`, `GL-MERGE-STATUS-ASYNC`, `GL-MERGE-STATUS-MULTIVALUED` — the spec's "asynchronous and multi-valued" clause split per spec OQ-3's variant-sub-case allowance), Jira 5 (`JIRA-LABEL-REPLACE`, `JIRA-CUSTOM-FIELD-TYPING`, `JIRA-TRANSITIONS-AS-DATA`, `JIRA-COMMENT-OMISSION`, `JIRA-UPDATED-ABSENT`), GitHub 3 (`GH-REVIEW-STATE`, `GH-CHECK-RUNS-PER-SHA`, `GH-ISSUE-TO-WORKITEM`). Meets NFR-2 minima (≥3/≥4/≥3). Flagged for DoR confirmation.
- **OQ-D — GitLab merge-status mapping**: the mapping ships as **declared, reviewable adapter data** in the GitLab seed (a native-value → rule table). Derivation rule: `DeliveryRequestReviewState` = f(MR `state`, `draft` flag, approvals, `detailed_merge_status`); **`detailed_merge_status` is authoritative when present**, `merge_status` is the fallback when the detailed field is absent; asynchronous values (`checking`, `unchecked`, `ci_still_running`, …) map to **non-terminal** states only; a native value outside the declared table **fails visibly** (classified result) rather than silently flattening. TC-GITLAB-003 asserts exhaustiveness over the committed fixture value set, the non-terminal guard for async values, and the precedence rule; the concrete per-value rows are declared data reviewed in the PR and extensible without contract change.
- **OQ-E — `updatedAt` string policy**: **verbatim** — the provider-native string (Jira `updated`, GitHub `updated_at`) is copied as-is onto `WorkItem.updatedAt` with no canonical re-rendering, no offset conversion, and no derivation; absence stays absence. Tests assert the fixture-populated values are ISO-8601 UTC-parseable; non-parseable native values are out of fixture scope and revalidated by M0-S20 live runs.
- **OQ-F — contract-inventory claim**: the delivered fixture pins export names only; P1 adds a **field-shape probe** (exact `WorkItem` field set, optionality, readonly) to `tests/structure/port-contract-inventory.test.ts` with its own fixture section, so ADR-0004 C-1 / ADR-0006 C-1 are mechanically true.
- **OQ-G — gap reason per operation** (recorded so TC-CAP-001 asserts the exact mapping, not just validity):

| Client | Supported | Gap → reason |
|---|---|---|
| Jira | `read-work-item` | `write-work-item`, `transition-work-item`, `write-comment` → `adapter-not-implemented` (deferred to M0-S14 per OQ-2); `read-delivery-request`, `write-delivery-request`, `read-pipeline-run` → `provider-unsupported` (tracker system; no PR/MR/pipeline surface) |
| GitLab | `read-delivery-request`, `read-pipeline-run` | `write-delivery-request` and the four work-item ops (`read-work-item`, `write-work-item`, `transition-work-item`, `write-comment`) → `adapter-not-implemented` (GitLab issues exist as provider capability; out of this seed's scope) |
| GitHub | `read-work-item`, `read-delivery-request`, `read-pipeline-run` | `write-work-item`, `write-delivery-request`, `transition-work-item`, `write-comment` → `adapter-not-implemented` (deferred to M3-S3) |

  All three seeds declare `writableCarriers: []` and `readableCarriers: []` (no envelope-carrier surface in this change; spec §7.2 OUT). Jira's internal comment reads populate `WorkItem.comments` and are not separately declarable — `ADAPTER_OPERATIONS` has no read-comment member.
- **OQ-H — fixture provenance**: no live tenant is accessible in this delivery environment, so fixtures are **hand-authored synthetic captures** shaped on current provider REST responses, sanitized per F-6 with declared placeholders, each carrying a provenance marker (e.g., `"provenance": "hand-authored-synthetic 2026-10-31"` outside trap-pointer targets), and labelled for revalidation at M0-S20. The sanitization audit and its canary (TC-FIXTURE-001/002) apply regardless.

### Open questions

- None blocking. OQ-C (GitLab split counting) is flagged for the DoR gate to confirm; every other test-plan §8.3 item is resolved above or by the ADRs.

## Scope

### In Scope

- **F-1**: three client seeds behind the primitive ports with honest `AdapterCapabilityDeclaration`s (per-client postures per the OQ-G table).
- **F-2**: GitLab seed — MR reads → `DeliveryRequest`, pipeline-per-commit reads → `PipelineRun`, merge-status normalization per the OQ-D rule.
- **F-3**: Jira read slice — issue reads → `WorkItem` answering the four M0-S6 tracker query families; label-replace, custom-field (DM-8 mapping data), transitions-as-data (`WorkflowMap`, DM-4), and comment-omission (ADR-0006) trap coverage.
- **F-4**: minimal GitHub read slice — PRs, check runs per SHA, issues; the complete status/verify input set (DEC-5).
- **F-5**: trap catalogs as four-field data entries + offline trap suites with a firing negative control and bidirectional catalog↔assertion coverage.
- **F-6**: recorded sanitized fixtures under `tests/fixtures/providers/**` + sanitization audit + planted-secret canary.
- **F-7**: credential-port-exclusive resolution in all three clients; `config.credential.missing` classification; secret-read allowlist stays at exactly 4 entries with provider-subpath planted violations firing.
- Contract extensions per ADR-0004/ADR-0006 (DM-6, DM-7) with the field-shape probe; runtime-confinement admission per ADR-0005 with negative fixtures.

### Out of Scope

- Full GitHub adapter / write ops (NG-1, M3-S3); conformance suite, mock tenants, live runs (NG-2, M0-S20); status/verify commands (NG-3, DEC-5); closeout write path incl. Jira transition execution (NG-5, OQ-2, M0-S14); Azure/CI seeds; provider engine routing; new CLI/MCP surface; envelope writes/parses beyond the delivered codec; bash stack, public naming, branding resolver.
- **Documentation impacts are NOT a plan phase**: the lifecycle doc-sync phase (phase 7, `@doc-syncer`) owns the new feature spec, `feature-adapter-ports.md` updates (`WorkItem` port-table row, boundaries section, consumed-by/risks), the scaffold-spec confinement bullet, and the ADR-0003 editorial pointer per ADR-0005. P10 hands off; nothing here edits `doc/spec/**`.
- **No edits** to `scripts/checks/secret-read-boundary.ts` (allowlist frozen at 4), `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/`, or bash CI jobs; `.github/workflows/ci.yml` unchanged (existing jobs discover all new suites).

### Constraints

- **Read before editing**: `@coder` reads [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) before touching `packages/**`/`tests/**` (strict TS, ports/adapters, error contract, bun:test rules) and [.ai/rules/bash.md](../../../../.ai/rules/bash.md) if any shell script is touched (none expected).
- **Runtime-tier purity**: native `fetch` only inside the three provider subpaths (admitted in P2); core `./contracts` stays types/`as const` only; no `node:*`/`bun:*` imports in neutral tiers; clients accept an **injected fetch-shaped transport** and an **injected `CredentialPort`** as construction inputs (test-plan §7.2 testability contract); no module-level cached transport or credential.
- **Credentials**: only via `CredentialPort` (type from `@delivery-os/core/contracts`; production composition uses `createProcessCredentialPort` from `@delivery-os/adapters/credentials`); unresolvable → classified `config.credential.missing`; secret material never stored, logged, or fixture-recorded. Zero ambient environment reads in client code.
- **Zero new dependencies**: native `fetch` + custom Jira client only; no subprocess/CLI shell-outs (TC-LICENSE-001 step 4); license registry and lockfile unchanged.
- **Confinement discipline**: `.dependency-cruiser.cjs` entries are exact-path with per-entry reason comments citing ADR-0005; `registry` never admitted; widening (e.g. `providers/**`) must fail; rule changes ship with their fixtures in the same commit.
- **Boundary purity**: provider-native types never cross the port surface; exports from provider subpaths limited to the client factory, `AdapterContract`, and input types built from core contracts; no parallel view types (ADR-0004 C-3).
- **exactOptionalPropertyTypes**: normalizers must not emit `updatedAt: undefined` / `comments: undefined` — presence is asserted by construction (`if`-guard or conditional spread), asserted at the normalizer level (TC-CONTRACT-001 step 4).
- **Inventory discipline**: every new `packages/**` file joins `tests/structure/inventory.json`; module-level exported `as const` data (workflow map, custom-field mapping, merge-status table, capability declarations) joins `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` with the exact export list.
- **Fixture discipline**: fixtures live under `tests/fixtures/providers/**`, never named `*.test.ts`; references are `path#/json-pointer`; placeholders come from the declared registry; planted violations/mutations only in `mkdtemp` trees or `tests/fixtures/**`; `git status --porcelain` checked around read-only scans; no license headers on change artifacts or fixtures.
- **Build order**: `pnpm build` before dist-dependent suites and `pnpm check:boundaries` (workspace-import resolution); `pretest`/`pretypecheck` already build.
- **Commits**: one Conventional Commit per phase, scope `GH-188`, ≤100-char bodies, via `@committer`; each phase leaves `pnpm check` green where feasible (P1–P2, P4–P7 fully green; P3 lands the first client + harness green).

### Risks

- **RSK-1 (custom Jira client cost)**: read-slice-first bounds scope; mapping data (workflow, custom fields) is declared data, not code paths; `jira.js` fallback trigger recorded for M0-S14.
- **RSK-2 (fixture drift)**: fixtures provenance-labelled and dated (OQ-H); stable references survive re-recording; M0-S20 live runs are the drift detector.
- **RSK-3 (sanitization miss)**: audit + canary in P7; placeholder registry discipline; PR review checklist; hand-authored synthetic fixtures never touch real tenants.
- **RSK-4 (allowlist creep)**: exact-path reason-bearing entries; `registry`/`azure`/`ci` negative controls; literal `pathNot` assertion in `boundaries.test.ts`; widening mutation fails.
- **RSK-5 (port-shape churn)**: anticipated gap closed by ADR-0004 in P1; any further gap follows the same additive + decision-record path — STOP and route via `@decision-advisor`, never a silent reshape.
- **RSK-6 (CLI-basis coupling)**: moot for the recorded basis (direct REST); transport injection keeps offline testing basis-independent.
- **Plan-specific — harness seam erosion**: a future client reaching `fetch` outside the injected transport would pass a naive suite; the throwing-`fetch` guard, unfixtured-request failure, and bidirectional coverage meta-check (P7) are mandatory, not optional.

**Rollback**: additive change — no persisted state, no config keys, no bash-stack edits. Revert phase commits as one coherent unit; never split synchronized pairs (contract field ↔ field-shape probe; confinement entry ↔ boundary fixtures; client ↔ its trap catalog/fixtures); re-run `pnpm check` + `pnpm check:boundaries` after any rollback to confirm baseline.

### Success Metrics

- 3/3 client seeds with declarations from the closed operation set; 0 implied-parity claims (AC-F1-1).
- 11 trap entries (3/5/3) with all four DM-2 fields and ≥1 committed fixture each; 100% ticket-named families covered (AC-F5-1).
- 100% trap tests pass offline; 0 live network calls in CI; corrupted-normalization control fires naming its entry (AC-F5-2).
- 0 secrets/PII/private identifiers in fixtures; canary fires on every claimed shape (AC-F6-1).
- Secret-read allowlist exactly 4 entries; 0 ambient reads in client code; planted violations fire (AC-F7-1/2).
- 0 provider-native types exported past the port surface; boundary matrix incl. the DEC-1 extension green (AC-F1-2).
- 4/4 M0-S6 query families answerable from normalized Jira data (AC-F3-1); complete GitHub status/verify input set (AC-F4-1).
- 0 new dependencies; `pnpm check` green; bash jobs byte-unchanged (NFR-6/7).

## Phases

Execution order is strict: **P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → (P9 if findings) → P10**. Each phase ends in a verifiable state and one Conventional Commit (scope `GH-188`) via `@committer`. Run `pnpm build` before dist-dependent suites and boundary checks.

### Phase P1: Core contract extensions — optional `WorkItem.updatedAt` and optional `comments` (ADR-0004, ADR-0006)

**Goal**: Land the two additive v1 `WorkItem` shape changes and mechanically pin them (field-shape probe + type probes) so every client phase consumes stable contracts.

**Tasks**:

- [x] **P1-1** Extend `packages/core/src/contracts/ports.ts` (`WorkItem`): add `readonly updatedAt?: string` (ISO-8601 UTC; provider-native value normalized verbatim per OQ-E; absent = activity unknown, never derived) and relax `comments` to `readonly comments?: readonly WorkItemComment[]` (absent = comment set unknown; present incl. empty = provider-asserted set). No existing field removed, retyped, or made required (ADR-0004 C-1; ADR-0006 C-1); contracts tier stays types-only (C-2). Doc comments state the absence semantics. **ACs**: AC-F3-1 (contract half), AC-F1-2; **DM-6, DM-7**. **Files**: `packages/core/src/contracts/ports.ts`.
- [x] **P1-2** Add the field-shape probe (OQ-F) to `tests/structure/port-contract-inventory.test.ts`: pin the exact `WorkItem` field set — `identity`, `title`, `status`, `labels`, `assignee?`, `relations`, `comments?`, `updatedAt?` — each readonly, optionality exact; extend `tests/fixtures/ports/v1-contract-inventory.json` with a field-shape section (or sibling fixture `tests/fixtures/ports/workitem-field-shape.json`); both-direction export-name inventory unchanged (a field adds no export). Negative controls in `mkdtemp` copies: removing `updatedAt` and re-tightening `comments` to required each fail naming the field (TC-CONTRACT-001 steps 1–2, 5). **ACs**: AC-F3-1, AC-F1-2. **TCs**: TC-CONTRACT-001 (structure half). **Files**: `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` (+ optional sibling fixture).
- [x] **P1-3** Add type probes `tests/types/workitem-updated-at.type-test.ts` and `tests/types/workitem-comments.type-test.ts`, registered in `tests/types/tsconfig.json`: literals without `updatedAt`/`comments` and with `comments: []` compile; non-string `updatedAt`, non-array `comments`, provider-native timestamp objects, and reassignment to the readonly fields fail (`@ts-expect-error` with one-line reasons); `updatedAt: undefined` is not equivalent to absence under `exactOptionalPropertyTypes` (normalizer-level assertion lands with P3). **TCs**: TC-CONTRACT-001 (type half). **Files**: `tests/types/{workitem-updated-at,workitem-comments}.type-test.ts`, `tests/types/tsconfig.json`.
- [x] **P1-4** Verify contracts-tier neutrality and inventory hygiene: `bun test tests/structure/port-neutrality.test.ts` green (no clock/derivation/I/O entered contracts); `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` need no change (no new module, no new `as const` export) — verify, don't edit. **ACs**: AC-F1-2 (NFR-1). **TCs**: TC-CONTRACT-001 step 6.

**Acceptance Criteria**:

- Must: field-shape probe green with both extensions pinned; removal/re-tightening mutations fail by field name (ADR-0004 C-1, ADR-0006 C-1).
- Must: export-name inventory unchanged; port-neutrality green; `pnpm typecheck` incl. `tests/types` green.
- Should: zero in-repo consumer breakage (the relaxation is producer-compatible; no consumer reads `comments` today).

**Files and modules**:

- Code areas: `packages/core/src/contracts/ports.ts` (updated); `tests/structure/port-contract-inventory.test.ts` (updated); `tests/fixtures/ports/v1-contract-inventory.json` (updated); `tests/types/workitem-updated-at.type-test.ts`, `tests/types/workitem-comments.type-test.ts`, `tests/types/tsconfig.json` (new/updated).
- System docs: none (doc-sync phase owns the port-table row).

**Tests**:

- `pnpm build && bun test tests/structure/port-contract-inventory.test.ts tests/structure/port-neutrality.test.ts && pnpm typecheck && pnpm check`.

**Completion signal**: `feat(GH-188): add optional WorkItem.updatedAt and optional comments per ADR-0004/ADR-0006`

---

### Phase P2: Runtime-API confinement admission for provider client subpaths (ADR-0005)

**Goal**: Admit `github`/`gitlab`/`jira` provider client subpaths to `runtime-apis-confinement` as exact, reason-bearing entries with fail-closed negative fixtures — before any client code performs I/O.

**Tasks**:

- [x] **P2-1** Extend `.dependency-cruiser.cjs` `runtime-apis-confinement`: add `github|gitlab|jira` to the adapters `pathNot` group with per-entry reason comments citing ADR-0005 and GH-188 (network I/O per provider client seed); update the rule comment; `registry` stays absent and all remaining adapter subpaths stay non-I/O (ADR-0005 C-2). **ACs**: AC-F1-2 (confinement half), AC-F7-1 (allowlist-unchanged context). **Files**: `.dependency-cruiser.cjs`.
- [x] **P2-2** Update the literal `pathNot` assertion in `tests/boundaries/boundaries.test.ts` to pin the post-change array exactly (no wildcard/prefix; `registry` absent — TC-BOUNDARY-001 step 3). **TCs**: TC-BOUNDARY-001. **Files**: `tests/boundaries/boundaries.test.ts`.
- [x] **P2-3** Add boundary controls to `tests/boundaries/fixtures/cases.ts` + `tests/boundaries/fixture-registry.json`: clean controls `runtime-control-provider-{github,gitlab,jira}` (a `probe.ts` inside each provider subpath importing a runtime API — cruise clean); negative controls for runtime imports in `azure`, `ci` (and `registry` if not already covered) still violating; existing `runtime-node-fs-adapter-registry`/`runtime-node-fs-adapter-io` violations stay. Fixture-coverage meta-check green (every rule keeps a failing fixture; new controls registered — TC-BOUNDARY-001 steps 1–2, 4–6). **TCs**: TC-BOUNDARY-001. **Files**: `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json`.
- [x] **P2-4** Prove non-erosion: in temp config copies, widening the allowance to `providers/**` or adding `registry` fails the boundary suite (RSK-4; TC-BOUNDARY-001 step 5). Explicitly **do not touch** `SECRET_READ_ALLOWLIST` in `scripts/checks/secret-read-boundary.ts` (stays exactly 4 entries; provider-subpath planted violations are added in P6).

**Acceptance Criteria**:

- Must: cruise clean for runtime imports in all three provider subpaths; `registry`/`azure`/`ci`/`io` runtime imports still fail; fixture-coverage green; existing boundary matrix unregressed.
- Must: widening mutations fail; `pathNot` literal assertion exact.

**Files and modules**:

- Code areas: `.dependency-cruiser.cjs`, `tests/boundaries/{boundaries.test.ts,fixtures/cases.ts,fixture-registry.json}` (all updated).
- System docs: none (scaffold-spec + feature-adapter-ports alignment is doc-sync phase; ADR-0003 pointer is doc-sync).

**Tests**:

- `pnpm build && bun test tests/boundaries && pnpm check:boundaries && pnpm check`.

**Completion signal**: `feat(GH-188): admit provider client subpaths to runtime-API confinement per ADR-0005`

---

### Phase P3: Jira read-slice client seed, fixtures, trap suite, and shared trap harness

**Goal**: Deliver the Jira client (custom minimal read slice, direct REST via native `fetch` behind an injectable transport) normalizing issues to `WorkItem`, with the `WorkflowMap` and custom-field mapping as declared data, five-entry trap catalog, sanitized fixtures, the four M0-S6 query-family suites, and the shared `trap-harness.ts` used by P4/P5.

**Tasks**:

- [x] **P3-1** Implement `packages/adapters/src/jira/` (proposed split; @coder may consolidate within the subpath but exports only via `index.ts`): `client.ts` — `createJiraClient` accepting an injected `CredentialPort` and an injected fetch-shaped transport (production default transport uses native `fetch`; credentials resolved per-request from the declared `ExternalSystemInstance` auth reference; unresolvable → classified `config.credential.missing` via the result contract, transport never called); `normalize.ts` — issue → `WorkItem` (provider-qualified identity; status = native + `DeliveryStateAlias` via the WorkflowMap; labels verbatim per replace semantics; assignee; typed relations incl. both `blocks`/`blocked-by` directions; `comments` populated only from actually-obtained payloads — absent otherwise per ADR-0006; `updatedAt` verbatim from native `updated` per OQ-E, never `undefined`-assigned); `workflow-map.ts` — declared `WorkflowMap` data (DM-4: every native status → alias + `WorkflowTransitionMechanism`); `custom-fields.ts` — declared DM-8 mapping data (which custom fields feed which normalized fields with declared types; unmapped visibly unrepresented; no `customfield_*` key crosses); `capabilities.ts` — `AdapterContract` per the OQ-G Jira row. **ACs**: AC-F3-1, AC-F3-2, AC-F1-1 (Jira half). **TCs**: TC-JIRA-001–004 (implementation side). **Files**: `packages/adapters/src/jira/{index,client,normalize,workflow-map,custom-fields,capabilities}.ts`.
- [x] **P3-2** Author sanitized fixtures under `tests/fixtures/providers/jira/`: `labels-replace-before.json`, `labels-replace-after.json`, `custom-fields.json`, `transitions.json`, `workflow-map.json`, `comments-omitted.json`, `comments-empty.json`, `stalls.json` (all four updated/comments presence combinations), `tracker-queries.json` (sections `#/owner-hand-backs`, `#/blocked-dependencies`, `#/ticket-hygiene`). Hand-authored synthetic per OQ-H with provenance markers and placeholder-substituted values (hosts on reserved/example domains). **ACs**: AC-F6-1 (Jira half). **TCs**: fixture side of TC-JIRA-001–008. **Files**: `tests/fixtures/providers/jira/*.json`.
- [x] **P3-3** Add the trap catalog `tests/fixtures/providers/traps/jira.traps.json` (5 entries, exactly four DM-2 fields each, `path#/json-pointer` references per the test-plan index) and the shared harness `tests/behaviour/providers/trap-harness.ts`: `runTrapCatalog({ catalogRoot, client, transport })` returning per-entry results keyed by trap name; every failure message includes trap name + fixture reference; catalog-root parameterized so P7's negative controls can point at temp copies. **ACs**: AC-F5-1 (Jira half), AC-F5-2 (infra). **Files**: `tests/fixtures/providers/traps/jira.traps.json`, `tests/behaviour/providers/trap-harness.ts`.
- [x] **P3-4** Add `tests/behaviour/providers/jira-trap.test.ts`: replay through the production client with injected fixture transport — label replace before/after (never accumulated; set-compare); custom fields typed per mapping + no raw-key leak + visible non-representation (mutation controls: stringify a mapped value, leak an unmapped key); WorkflowMap closed/exhaustive with a mechanism per mapping (remove-mechanism mutation fails); comments omitted vs present-empty distinguishable, never collapsed to `[]` (collapse mutation fails); each mutation fails naming its trap entry. **ACs**: AC-F3-2. **TCs**: TC-JIRA-001, TC-JIRA-002, TC-JIRA-003, TC-JIRA-004. **Files**: `tests/behaviour/providers/jira-trap.test.ts`.
- [x] **P3-5** Add `tests/behaviour/providers/jira-queries.test.ts` with test-local pure predicates (the collector is M0-S6) over normalized `WorkItem` values: owner hand-backs (assignee/ownership labels), blocked dependencies (typed relations, both directions, provider-qualified targets, no key-string parsing), stalls via `updatedAt` with injected clock/threshold — present → active/stalled deterministically; absent → **activity unknown**, neither active nor stale, no fabricated timestamp (fabrication mutation fails naming `JIRA-UPDATED-ABSENT`); ticket hygiene (labels/status/fields conformance; cross-check replace semantics with TC-JIRA-001). Reverse-order replay determinism. **ACs**: AC-F3-1 (all four families). **TCs**: TC-JIRA-005, TC-JIRA-006, TC-JIRA-007, TC-JIRA-008. **Files**: `tests/behaviour/providers/jira-queries.test.ts`.
- [x] **P3-6** Register new `packages/**` files in `tests/structure/inventory.json`; add module-level exported `as const` data (workflow map, custom-field mapping, capability declaration) to `EXECUTABLE_ALLOWANCES` with exact export lists; subpath registration needs no change (already registered — verify `tests/structure/subpaths.test.ts` and `bun run scripts/checks/workspace-entrypoints.ts` green after build).

**Acceptance Criteria**:

- Must: all four query families answerable from normalized `WorkItem` data alone; label/custom-field/transition/comment-omission traps pass offline against fixtures with mutations failing by trap name (AC-F3-1, AC-F3-2).
- Must: credential resolution through the injected port only; classified failure on unresolvable reference; zero ambient reads in `packages/adapters/src/jira/**`.
- Should: normalizer never emits `updatedAt`/`comments` keys with `undefined` values (exactOptionalPropertyTypes discipline).

**Files and modules**:

- Code areas: `packages/adapters/src/jira/**` (new implementation replacing placeholders), `tests/fixtures/providers/jira/**`, `tests/fixtures/providers/traps/jira.traps.json`, `tests/behaviour/providers/{trap-harness.ts,jira-trap.test.ts,jira-queries.test.ts}`, `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (all new/updated).
- System docs: none.

**Tests**:

- `pnpm build && bun test tests/behaviour/providers/jira-trap.test.ts tests/behaviour/providers/jira-queries.test.ts && bun test tests/structure && pnpm check:boundaries && pnpm check`.

**Completion signal**: `feat(GH-188): add Jira read-slice client seed with trap catalog and tracker-query fixtures`

---

### Phase P4: GitLab client seed with pipeline-multiplicity and merge-status traps

**Goal**: Deliver the GitLab client (direct REST via native `fetch` behind an injectable transport): MR reads → `DeliveryRequest`, truthful per-commit pipeline sets → `PipelineRun`, declared merge-status mapping per OQ-D; three-entry trap catalog proven offline.

**Tasks**:

- [x] **P4-1** Implement `packages/adapters/src/gitlab/`: `client.ts` — `createGitLabClient` (injected `CredentialPort` + transport; same credential contract as P3); `normalize.ts` — MR → `DeliveryRequest` (provider-qualified identity; source/target refs verbatim; review state from the closed `DeliveryRequestReviewState` set via the declared mapping; review threads → `DeliveryThread` with stable ids/resolved flags/comment counts) and pipelines-per-commit → complete `PipelineRun` set (distinct identities; `PipelineJobState` job states; `TraceEvidenceRef` where traces exist — never a bare status colour, never a silently picked singleton; missing jobs list reported, never invented); `merge-status.ts` — declared mapping data per OQ-D (`detailed_merge_status` authoritative; `merge_status` fallback; async values non-terminal; unknown value → visible classified failure); `capabilities.ts` — `AdapterContract` per the OQ-G GitLab row. **ACs**: AC-F2-1, AC-F1-1 (GitLab half). **TCs**: TC-GITLAB-001–003 (implementation side). **Files**: `packages/adapters/src/gitlab/{index,client,normalize,merge-status,capabilities}.ts`.
- [x] **P4-2** Author sanitized fixtures `tests/fixtures/providers/gitlab/`: `merge-requests.json` (identity, refs, draft/open states, review threads), `pipelines-per-commit.json` (one SHA with branch + MR pipelines, distinct jobs/traces), `merge-status-async.json` (`checking`/`unchecked`), `merge-status-multivalued.json` (`merge_status` vs `detailed_merge_status` disagreeing). Provenance markers per OQ-H. **ACs**: AC-F6-1 (GitLab half). **Files**: `tests/fixtures/providers/gitlab/*.json`.
- [x] **P4-3** Add `tests/fixtures/providers/traps/gitlab.traps.json` (3 entries: `GL-PIPELINE-MULTIPLICITY`, `GL-MERGE-STATUS-ASYNC`, `GL-MERGE-STATUS-MULTIVALUED`) and `tests/behaviour/providers/gitlab-trap.test.ts`: MR normalization with deterministic double replay and no provider-native leakage; complete per-commit pipeline set with order-insensitive comparison (pipeline-removal mutation fails naming the trap entry); exhaustive mapping over the fixture value set with async-never-terminal and precedence-rule assertions (map-`checking`-to-terminal mutation fails naming `GL-MERGE-STATUS-ASYNC`). **ACs**: AC-F2-1. **TCs**: TC-GITLAB-001, TC-GITLAB-002, TC-GITLAB-003. **Files**: `tests/fixtures/providers/traps/gitlab.traps.json`, `tests/behaviour/providers/gitlab-trap.test.ts`.
- [x] **P4-4** Inventory/allowance registration as in P3-6 (new files + `as const` exports).

**Acceptance Criteria**:

- Must: per-commit pipeline set complete and truthful under multiplicity; merge status normalized through the declared exhaustive mapping with no silent flattening; mutations fail by trap name (AC-F2-1, DM-5).
- Must: zero ambient reads in `packages/adapters/src/gitlab/**`; credentials only via the port.

**Files and modules**:

- Code areas: `packages/adapters/src/gitlab/**`, `tests/fixtures/providers/gitlab/**`, `tests/fixtures/providers/traps/gitlab.traps.json`, `tests/behaviour/providers/gitlab-trap.test.ts`, `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`.
- System docs: none.

**Tests**:

- `pnpm build && bun test tests/behaviour/providers/gitlab-trap.test.ts && pnpm check`.

**Completion signal**: `feat(GH-188): add GitLab client seed with pipeline-multiplicity and merge-status trap catalog`

---

### Phase P5: GitHub minimal read slice with review-state, check-run, and issue traps

**Goal**: Deliver the GitHub read slice (direct REST via native `fetch` behind an injectable transport): PRs → `DeliveryRequest`, check runs per SHA → `PipelineRun`, issues → `WorkItem` (incl. `updatedAt`); three-entry trap catalog plus the composite status/verify input-set suite (DEC-5).

**Tasks**:

- [x] **P5-1** Implement `packages/adapters/src/github/`: `client.ts` — `createGitHubClient` (injected `CredentialPort` + transport; same credential contract); `normalize.ts` — PR → `DeliveryRequest` (review state from the closed set via the declared mapping incl. `reviewDecision` vs raw `state` divergence, draft/open/changes-requested/approved/merged/closed; threads → `DeliveryThread`; no numeric review ids leak), check runs per SHA → complete `PipelineRun` set (conclusion/status pair → one closed-set state; a failed job never hidden behind a green roll-up; trace-evidence refs where URLs exist; disjoint sets across SHAs), issue → `WorkItem` (labels, assignee present/absent, open/closed state, `updatedAt` verbatim from `updated_at`, absent where the provider omits it; typed relations where issue links exist, none fabricated); `review-state.ts` — declared mapping data; `capabilities.ts` — `AdapterContract` per the OQ-G GitHub row. **ACs**: AC-F4-1, AC-F1-1 (GitHub half). **TCs**: TC-GITHUB-001–004 (implementation side). **Files**: `packages/adapters/src/github/{index,client,normalize,review-state,capabilities}.ts`.
- [x] **P5-2** Author sanitized fixtures `tests/fixtures/providers/github/`: `pr-review-states.json` (draft, open, changes-requested, approved, merged, closed; `reviewDecision` ≠ `state` case), `check-runs-per-sha.json` (success/failure/queued/skipped for one SHA + roll-up suite; two SHAs), `issues.json` (labels, assignee present/absent, open/closed, `updated_at` present and absent) — together representing one delivery scenario (PR + its head-SHA check runs + linked issue). Provenance markers per OQ-H. **ACs**: AC-F6-1 (GitHub half). **Files**: `tests/fixtures/providers/github/*.json`.
- [x] **P5-3** Add `tests/fixtures/providers/traps/github.traps.json` (3 entries) and `tests/behaviour/providers/github-trap.test.ts`: review-state mapping per variant with flattening mutation failing by name; complete per-SHA check-run set with dropped-failure mutation failing by name; issue→`WorkItem` incl. `updatedAt` presence/absence with assignee-swap mutation failing by name; no raw payload key/type leakage. **ACs**: AC-F4-1. **TCs**: TC-GITHUB-001, TC-GITHUB-002, TC-GITHUB-003. **Files**: `tests/fixtures/providers/traps/github.traps.json`, `tests/behaviour/providers/github-trap.test.ts`.
- [x] **P5-4** Add `tests/behaviour/providers/github-inputs.test.ts` (TC-GITHUB-004): resolve the delivery request, pipeline runs for its head SHA, and the linked work item through the slice; assert the returned set is exactly `DeliveryRequest` + `PipelineRun` + `WorkItem` and sufficient to answer CI-green/review-state/work-item-status-and-owner; no provider-native payload, no second provider call outside the seed, no live network (unfixtured request fails loudly through the fixture transport). **ACs**: AC-F4-1. **TCs**: TC-GITHUB-004. **Files**: `tests/behaviour/providers/github-inputs.test.ts`.
- [x] **P5-5** Inventory/allowance registration as in P3-6.

**Acceptance Criteria**:

- Must: the three read families normalize truthfully with mutations failing by trap name; the input set is complete for status/verify consumption without testing those downstream commands (AC-F4-1, DEC-5, DM-5/DM-6 population).
- Must: zero ambient reads in `packages/adapters/src/github/**`; credentials only via the port.

**Files and modules**:

- Code areas: `packages/adapters/src/github/**`, `tests/fixtures/providers/github/**`, `tests/fixtures/providers/traps/github.traps.json`, `tests/behaviour/providers/{github-trap.test.ts,github-inputs.test.ts}`, `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`.
- System docs: none.

**Tests**:

- `pnpm build && bun test tests/behaviour/providers/github-trap.test.ts tests/behaviour/providers/github-inputs.test.ts && pnpm check`.

**Completion signal**: `feat(GH-188): add GitHub read-slice client seed with review-state, check-run and issue traps`

---

### Phase P6: Capability honesty, credential-port exclusivity, and surface purity (cross-client)

**Goal**: Wire the three capability declarations into the mechanical honesty suite, prove credential-port exclusivity with the allowlist frozen at four, and pin port-surface purity — the F-1/F-7 evidence that is only assertable with all three clients present.

**Tasks**:

- [x] **P6-1** Extend `tests/fixtures/ports/capabilities.ts` with the three seed declarations (exact OQ-G mapping incl. gap reasons and empty carrier arrays) and add `tests/behaviour/provider-capabilities.test.ts`: closed-set membership, no duplicates, complete gap records (exactly one per unsupported operation, valid reason, none for supported), per-client postures (GitHub gaps all writes; GitLab MR/pipeline reads only; Jira `read-work-item` with write/transition/comment gaps), no implied parity, positive/negative declaration-vs-implementation pairs; mutations (remove a Jira write gap; add a non-operation string) fail. **ACs**: AC-F1-1. **TCs**: TC-CAP-001. **Files**: `tests/fixtures/ports/capabilities.ts`, `tests/behaviour/provider-capabilities.test.ts`.
- [x] **P6-2** Add `tests/behaviour/provider-credentials.test.ts`: per seed — resolution through a recording `CredentialPort` with the declared reference; secret used to build the provider request, never stored on the client instance; canary secret absent from captured diagnostics/logs/errors (raw + JSON-escaped); unresolvable (absent key and empty-string value) → exactly `config.credential.missing` (domain `config`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`); transport never called after credential failure; no containment to `fallback.*`, no environment dump. **ACs**: AC-F7-1 (port half), AC-F7-2. **TCs**: TC-CRED-002, TC-CRED-001 (behaviour half). **Files**: `tests/behaviour/provider-credentials.test.ts`.
- [x] **P6-3** Extend `tests/fixtures/secret-boundary/cases.ts` + `tests/checks/secret-read-boundary.test.ts`: plant `process.env.SECRET` and a computed-key form inside `mkdtemp`-materialized copies of each of `packages/adapters/src/{github,gitlab,jira}/` — the check fails naming rule/file/line (provider subpaths are not allowlisted); live-tree `validate(process.cwd())` asserts zero violations, **exactly four allowlisted entries**, exactly one `credential-material`, non-zero scoped files; existing allowlist mutation tests still fail closed; `git status --porcelain` unchanged around read-only scans. `scripts/checks/secret-read-boundary.ts` itself is NOT edited. **ACs**: AC-F7-1 (allowlist half). **TCs**: TC-CRED-001 (static half). **Files**: `tests/fixtures/secret-boundary/cases.ts`, `tests/checks/secret-read-boundary.test.ts`.
- [x] **P6-4** Add `tests/structure/provider-surface.test.ts` and `tests/types/provider-views.type-test.ts` (registered in `tests/types/tsconfig.json`): per subpath, exported names are only the client factory/declaration and core-built input types; no provider-native shape names (`GitLabMR`, `JiraIssue`, `OctokitResponse`, raw payload types), no `any`/`unknown`-erasing wrappers, no parallel view type augmenting a primitive view (ADR-0004 C-3); type-level: each client's read returns are assignable to `DeliveryRequest`/`PipelineRun`/`WorkItem` as the declared return types; temp-copy native-export mutation fails by name. **ACs**: AC-F1-2. **TCs**: TC-SURFACE-001. **Files**: `tests/structure/provider-surface.test.ts`, `tests/types/provider-views.type-test.ts`, `tests/types/tsconfig.json`.

**Acceptance Criteria**:

- Must: capability honesty mechanically enforced against the exact OQ-G table; mutations fail (AC-F1-1, NFR-5).
- Must: allowlist stays exactly four entries; planted violations in all three provider subpaths fire; classification exact (AC-F7-1/2, NFR-4).
- Must: surface purity green at AST and type level (AC-F1-2, NFR-1).

**Files and modules**:

- Code areas: `tests/fixtures/ports/capabilities.ts`, `tests/behaviour/{provider-capabilities.test.ts,provider-credentials.test.ts}`, `tests/fixtures/secret-boundary/cases.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/types/{provider-views.type-test.ts,tsconfig.json}` (new/updated). No production code changes expected — a failure here reopens the offending client phase.
- System docs: none.

**Tests**:

- `pnpm build && bun test tests/behaviour/provider-capabilities.test.ts tests/behaviour/provider-credentials.test.ts tests/checks/secret-read-boundary.test.ts tests/structure/provider-surface.test.ts && bun run scripts/checks/secret-read-boundary.ts && pnpm typecheck && pnpm check`.

**Completion signal**: `test(GH-188): enforce capability honesty, credential-port exclusivity and provider surface purity`

---

### Phase P7: Trap-catalog data discipline, offline negative control, and fixture sanitization audit

**Goal**: Make the catalogs and fixtures mechanically trustworthy: schema/coverage/minima enforcement, the firing corrupted-normalization negative control with zero-live-call proof, the sanitization audit with its planted-secret canary.

**Tasks**:

- [x] **P7-1** Add `tests/structure/trap-catalog.test.ts`: load every `tests/fixtures/providers/traps/*.traps.json`; each entry has exactly the four DM-2 keys with non-empty values; trap names unique within and across catalogs; every `path#/json-pointer` reference resolves under `tests/fixtures/providers/**`; per-provider minima GitLab ≥3, Jira ≥4, GitHub ≥3 and every ticket-named family covered; catalogs are data-only (no executable code); mutations (delete entry, add fifth field, break reference, drop Jira below four) each fail by name. **ACs**: AC-F5-1. **TCs**: TC-TRAP-001. **Files**: `tests/structure/trap-catalog.test.ts`.
- [x] **P7-2** Complete the offline negative-control harness in `tests/behaviour/providers/trap-harness.ts` + the per-client trap suites: a throwing `fetch` guard installed for the suite records zero calls (any call fails); run every catalog entry through its client — 100% pass, assertions keyed by trap name; double-run identical results, no order dependence; negative control A — corrupt a normalizer mapping in a temp copy (e.g., `checking` → terminal) and the suite fails naming trap name + fixture reference; negative control B — an unfixtured provider path fails loudly instead of reaching the network; bidirectional catalog↔assertion coverage meta-check (entry without assertion and assertion without entry both fail). **ACs**: AC-F5-2. **TCs**: TC-TRAP-002. **Files**: `tests/behaviour/providers/trap-harness.ts`, `tests/behaviour/providers/{jira,gitlab,github}-trap.test.ts` (extended).
- [x] **P7-3** Add `tests/checks/fixture-sanitization.test.ts` with an exported pure `scan(root)` and the committed placeholder registry + canary cases under `tests/fixtures/providers/sanitization/` (`cases.ts` + placeholder list): scan every committed provider fixture for token-shaped strings (`Authorization: Bearer`, `ghp_`, `glpat-`, Jira API token form, PEM private keys), emails, avatar URLs, account identifiers, private repository references — only declared placeholders and documented provider field names allowed; no live host/tenant identifiers (reserved/example domains only); every declared placeholder used, every used placeholder declared; trap-catalog fixture references resolve and agree; non-vacuity (empty scope reported). Canary: each planted shape in a temp copy fails naming file + field/line; `mkdtemp`-only writes; clean control re-passes after canaries. **ACs**: AC-F6-1. **TCs**: TC-FIXTURE-001, TC-FIXTURE-002. **Files**: `tests/checks/fixture-sanitization.test.ts`, `tests/fixtures/providers/sanitization/{cases.ts,placeholders.json}`.

**Acceptance Criteria**:

- Must: catalogs meet the four-field schema and minima with resolvable stable references; reviewable as data (AC-F5-1, NFR-2).
- Must: 100% offline pass with zero live calls; corrupted normalization and unfixtured requests fail by trap name; coverage is bidirectional (AC-F5-2, NFR-3).
- Must: audit + canary green; planted secret shapes cannot pass; placeholders non-stale (AC-F6-1, RSK-3).

**Files and modules**:

- Code areas: `tests/structure/trap-catalog.test.ts`, `tests/checks/fixture-sanitization.test.ts`, `tests/fixtures/providers/sanitization/**`, `tests/behaviour/providers/{trap-harness.ts,*-trap.test.ts}` (new/extended).
- System docs: none.

**Tests**:

- `pnpm build && bun test tests/structure/trap-catalog.test.ts tests/checks/fixture-sanitization.test.ts tests/behaviour/providers && pnpm check`.

**Completion signal**: `test(GH-188): enforce trap-catalog schema, offline negative control and fixture sanitization audit`

---

### Phase P8: Code Review (Analysis)

**Goal**: Independently audit the delivered seeds against spec, plan, and test plan without modifying implementation during analysis.

**Tasks**:

- [x] **P8-1** PM delegates independent analysis to `@reviewer`: trace all 12 ACs and 28 TCs to code and non-vacuous evidence; inspect trap-catalog integrity (does each assertion actually fire), normalization truthfulness per quirk, credential leak controls, confinement entries vs ADR-0005, capability honesty vs the OQ-G table, and protected-path compliance (no `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/` changes; no hand-added headers; bash jobs byte-unchanged; brand-neutral constants). — DONE (review-iter-1.yaml: all 12 ACs PASS, independently re-run suites green).
- [x] **P8-2** Record findings/verdict through the review artifact workflow; route implementation findings to P9 and decision-class findings (contract reshape, allowlist growth, basis change) to the PM and `@decision-advisor` — never a silent alternative. — DONE (verdict PASS, 0 blocker/0 major/4 low/4 info recorded in `code-review/review-iter-1.yaml`; low findings routed to P11).

**Acceptance Criteria**:

- Must: reviewer produces a traceable PASS or actionable findings with no fabricated evidence; `@runner` reproduces questionable evidence rather than assuming passes.
- Must: any missing evidence or non-firing negative control is unfinished work; no severity downgrade to pass the gate.

**Files and modules**:

- Code areas: none (read-only analysis of P1–P7).
- System docs: none during analysis.

**Tests**:

- Evidence inspection for all 28 TCs; reproduction of sampled suites/mutations.

**Completion signal**: independent verdict recorded; PASS advances to P10, findings activate P9.

---

### Phase P9: Post-Code Review Fixes (conditional)

**Goal**: Close accepted review findings without scope expansion or regression loss.

**Tasks**:

- [x] **P9-1** If findings exist: reproduce each via the relevant TC/negative fixture, add the missing regression first, then apply the smallest fix; preserve behavior outside the accepted slice. — DONE via P11 (comment/data fixes, plus the GH-REVIEW-STATE assertion extension in `github-trap.test.ts`).
- [x] **P9-2** Fix code, catalogs, fixtures, and registries together — a confinement or catalog change carries its fixtures in the same fix; a contract-shape dispute routes through `@decision-advisor`, never a silent reshape (RSK-5 path). — DONE (trap wording + assertion in the same commit; no contract or confinement change).
- [x] **P9-3** PM delegates `@runner` repetition of affected suites/mutations and the full gates, and independent re-review until PASS. If no findings, record the phase as not required with the P8 PASS as evidence. — DONE for gate repetition (`pnpm check` 806 pass, targeted trap/structure suites green). Post-fix independent re-review waived by the PM's explicit `no review` instruction for this remediation round; P11 is comment/data/assertion-only and P8 verdict was PASS.

**Acceptance Criteria**:

- Must: all accepted findings closed; affected ACs remain traceable; previously green controls stay green.
- Must: no waived check, no undocumented scope expansion, no unresolved blocker.

**Files and modules**:

- Code areas: only affected P1–P7 files and their regressions; no blanket cleanup.
- System docs: none.

**Tests**:

- Reproduce failing TC cases; re-run affected suites, then the P10 gate battery.

**Completion signal**: reviewer PASS after fixes, or explicit not-required state backed by P8 PASS.

---

### Phase P10: Finalize and Release — gates, DoD predicates, version intent, handoffs

**Goal**: Full gate run, DoD verification against spec §18, version intent per repo conventions, and coherent handoffs (doc-sync out-of-plan; PR via lifecycle phase 11) as an open unmerged PR to `main-tools`.

**Tasks**:

- [x] **P10-1** Version bump per repo conventions: add a Changesets **minor** declaration for the five-package fixed group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) mirroring the GH-181/GH-173 precedent — the core contract extension plus new adapter implementations warrant minor; `changesets-group` and `testkit-exclusion` checks green; no hand-bumps, no publish. **Files**: `.changeset/gh-188-client-seeds-minor.md`. — DONE (changeset added; both checks pass; config untouched).
- [x] **P10-2** Spec reconciliation handoff (doc-sync is lifecycle phase 7, out of this plan): hand `@doc-syncer` the new feature spec for provider client seeds and trap catalogs (always-resolve), `feature-adapter-ports.md` updates (`WorkItem` port-table row with `updatedAt`/optional `comments` semantics; Security-and-Boundaries confinement enumeration; consumed-by/risks), the scaffold-spec confinement bullet, and the ADR-0003 editorial pointer per ADR-0005; verify no stale doc claims contradict the delivered surface. ADR-0004/0005/0006 acceptance rides the GH-188 PR review (records stay Proposed until owner acceptance). — DONE in doc-sync commit `4162c89` (review-iter-1 verified accurate); P11 adds the intra-package import note; `test-doc-distribution.sh` PASS.
- [x] **P10-3** Final ordered gate battery via `@runner`, recorded with commands, results, and tested SHA: `pnpm install --frozen-lockfile` → `pnpm build` → `bun test tests/structure tests/behaviour tests/checks tests/boundaries` → `bun run scripts/checks/secret-read-boundary.ts` → `bun run scripts/checks/license-audit.ts` → `bun run scripts/checks/forbidden-literals.ts` → `pnpm check:boundaries` → `pnpm typecheck` → `pnpm check` → `bash scripts/.tests/test-doc-distribution.sh` → `git diff --check`. Assert bash jobs and `scripts/**` byte-unchanged for this change; confirm CI wiring covers the new suites through existing jobs (`ts-test`, `ts-typecheck`, `ts-boundaries`, `ts-invariants`, `ts-license-audit`, `ts-aggregate`) with no new job. Record per-TC evidence in the test plan §10 execution log. **TCs**: TC-GATE-001, TC-LICENSE-001 (incl. manifest/lockfile diff vs pre-change baseline — zero new dependencies — and no subprocess/CLI shell-out in the seeds).
- [x] **P10-4** DoD predicate checklist (spec §18) — verify each predicate against current evidence; PM confirms all 12 ACs have passing traceable evidence and records divergences for escalation rather than rewriting requirements:
  - [x] All 12 ACs (AC-F1-1 … AC-F8-1) have passing, traceable evidence (TC table below; test-plan §10). — PASSED (review-iter-1 `ac_trace` re-ran and verified all 12; test-plan §10 records per-TC results).
  - [x] Trap suite passes offline in CI; negative control fires naming its entry (P7; TC-TRAP-002). — PASSED (`bun test tests/behaviour/providers` 78 pass; throwing-fetch guard zero calls; mutation controls fire by trap name; `pnpm check` 806 pass).
  - [x] Secret-read invariant green with exactly four entries; still fires on planted violations (P6; TC-CRED-001). — PASSED (`secret-read-boundary: 70 production files clean (4 allowlisted entries)`; planted-read tests in `tests/checks/secret-read-boundary.test.ts` green).
  - [x] `pnpm check` passes (P10-3; TC-GATE-001). — PASSED (`pnpm check` at code HEAD `162e61e`: lint, format, typecheck, 806 tests, boundaries, exports-parity all green).
  - [x] Zero new dependencies; license registry unchanged and audit green (P10-3; TC-LICENSE-001). — PASSED (`license-audit` OK; `git diff origin/main-tools...HEAD -- pnpm-lock.yaml package.json packages/*/package.json` empty).
  - [x] Documentation synchronized — new feature spec, `feature-adapter-ports.md`, ADR-0005 alignment (pointer + spec sync) — owned by the doc-sync phase (P10-2 handoff). — PASSED (doc-sync commit `4162c89`, plus P11 intra-package note in `162e61e`; `test-doc-distribution.sh` no drift across 80 docs).
  - [x] ADR-0004 `updatedAt` present with the contract-inventory structure test green (P1; TC-CONTRACT-001). — PASSED (field-shape probe and `workitem-updated-at` type probe green in `pnpm check`).
  - [x] ADR-0006 semantics implemented: `WorkItem.comments` optional pinned by the field-shape probe; Jira custom-field mapping declared as reviewable data evidenced by `JIRA-CUSTOM-FIELD-TYPING` with no raw provider key crossing (P1, P3). — PASSED (TC-CONTRACT-001, TC-JIRA-002/004 green; no raw-key leak assertion).
  - [x] Implementation-basis evaluation recorded in the ticket before custom code — **already satisfied** (comment 6536692124); verify the recorded basis matches the delivered code (direct REST GitHub/GitLab; custom Jira read slice) and record the comment id/URL as TC-PLAN-001 evidence. — PASSED (review-iter-1 verified the comment predates `a335093` and matches delivered code; TC-PLAN-001 in test-plan §10).
  - [x] Open unmerged PR targeting `main-tools` with all required CI jobs green on the pushed HEAD — lifecycle phase 11 (`@pr-manager`); P10 records the handoff and stops. — HANDOFF (lifecycle phase 11). This remediation run did not push or open a PR per PM instruction; the predicate remains owed to `@pr-manager` and must be checked on the pushed HEAD.
- [ ] **P10-5** Rollback instructions and scope proof in the PR handoff: additive-only change (no persisted state, no config keys, no bash-stack edits); revert phase commits as one coherent unit per Scope > Rollback — never split the contract field from its probe, a confinement entry from its fixtures, or a client from its catalog; re-run baseline gates after any rollback.

**Acceptance Criteria**:

- Must: minor release intent present and consistent with the fixed group; gate battery green at the recorded SHA; every DoD predicate has current evidence or an explicit owner/handoff.
- Must: rollback coherent; PR open, unmerged, base `main-tools`, CI green on the pushed HEAD (via lifecycle phase 11).

**Files and modules**:

- Code areas: `.changeset/gh-188-client-seeds-minor.md`; no product-code change unless a gate reopens P9.
- System docs: handoff notes only; feature-spec authoring belongs to the doc-sync phase.

**Tests**:

- The P10-3 battery is the test set; no separate execution is claimed by this plan.

**Completion signal**: `chore(GH-188): add minor release intent, gate evidence and DoD checklist for PR handoff`

---

### Phase P11: Code Review Remediation (Iteration 1)

**Goal**: Close the four low-severity findings from the independent review iteration 1 (`code-review/review-iter-1.yaml`; verdict PASS, 0 blocker / 0 major / 4 low / 4 info). This phase discharges the P9 conditional obligation for iteration-1 findings; the info findings (F-5..F-8) are optional and require no gate change.

**Tasks**:

- [x] **P11-1** (F-1) Fix the module-header reference typo in `packages/adapters/src/jira/workflow-map.ts` ("DH-188 DM-4" → "GH-188 DM-4"). Comment-only; no behavior change; `pnpm check` stays green. **Files**: `packages/adapters/src/jira/workflow-map.ts`. — DONE (commit `162e61e`).
- [x] **P11-2** (F-2) Document the intra-package import exception for shared adapter support modules: relative `../io/*.js` imports (not the src-mapped `#io/*` alias, which cannot resolve in the dist-only packed tarball) in `doc/spec/features/feature-provider-client-seeds.md` (Provider transport section) or record the alternative — a dist-conditioned `#io` alias — as a decision for a later change. **Files**: `doc/spec/features/feature-provider-client-seeds.md` (or a decision-record stub). — DONE (new "Intra-package imports and packed exports" subsection + matching header note on `src/io/provider-transport.ts`; commit `162e61e`).
- [x] **P11-3** (F-3) Record the GitHub issue-status mapping limitation in the `GH-ISSUE-TO-WORKITEM` trap entry: `closed` maps to `done`; `state_reason` (`not_planned`) is not modeled until M0-S20 live runs record real shapes. Update `expectedNormalizedOutcome`/`providerBehavior` wording in `tests/fixtures/providers/traps/github.traps.json` (also reword the garbled "closed Set status alias" phrase, F-5); trap-catalog schema test must stay green. **Files**: `tests/fixtures/providers/traps/github.traps.json`. — DONE (four-field entry retained; `state_reason`/`not_planned` deferral to M0-S20 recorded; F-5 wording fixed; trap-catalog schema test green; commit `162e61e`).
- [x] **P11-4** (F-4) Declare the unknown-`reviewDecision` fallback ("open") on the `GITHUB_REVIEW_DECISION_STATES` table comment in `packages/adapters/src/github/review-state.ts`, or make the table exhaustive-with-visible-failure mirroring the GitLab OQ-D discipline. Comment-level fix preferred (no fixture change). **Files**: `packages/adapters/src/github/review-state.ts`. — DONE (declared `GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK` marker + table comment; behavior unchanged; GH-REVIEW-STATE trap assertion extended to cover unknown-native and terminal precedence; commit `162e61e`).
- [x] **P11-5** Re-run `pnpm check` and the provider trap suites; commit the remediation as one Conventional Commit (`fix(GH-188): ...` or `docs(GH-188): ...` per the touched surface); commit the pending `chg-GH-188-pm-notes.yaml` working-tree change (F-8) so the tree is clean before phase 11 PR creation. — DONE (`pnpm check` 806 pass / 0 fail; provider suites green; remediation committed as `162e61e`; tree was already clean — F-8 pm-notes change landed in `ef9462d`).

**Acceptance Criteria**:

- Must: all four low findings closed with the smallest diff; no assertion weakened; `pnpm check` green; trap-catalog schema test green after the F-3/F-5 wording updates.
- Must: working tree clean of stray doc modifications before PR creation.

**Files and modules**:

- Code areas: `packages/adapters/src/jira/workflow-map.ts`, `packages/adapters/src/github/review-state.ts` (comment-only edits); `tests/fixtures/providers/traps/github.traps.json` (data wording); `doc/spec/features/feature-provider-client-seeds.md` (convention note).
- System docs: the P11-2 note rides the doc-sync surface owned by lifecycle phase 7.

**Tests**:

- `pnpm check` (aggregate) — no dedicated new suite; the existing trap-catalog schema test covers the fixture wording change.

**Completion signal**: `fix(GH-188): close review iteration 1 low findings`

## Test Scenarios

All 28 TCs from the test plan (v1.2) land in a phase; TC IDs, AC traces, and target files follow test-plan §§5–7 (locations authoritative there; this plan's only reconciliations are the phase assignments and the OQ-C..OQ-H decisions recorded in Context).

| TC ID | Scenario | AC | Phase(s) | Suite / file |
|---|---|---|---|---|
| TC-CONTRACT-001 | Additive `WorkItem` extensions (`updatedAt`, optional `comments`) | AC-F3-1, AC-F1-2 | P1 (asserted through P3/P5 normalizers) | `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, `tests/types/workitem-{updated-at,comments}.type-test.ts` |
| TC-BOUNDARY-001 | Runtime confinement admission and negative controls | AC-F1-2, AC-F7-1 | P2 | `tests/boundaries/boundaries.test.ts`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json`, `.dependency-cruiser.cjs` |
| TC-JIRA-001 | Label replace semantics reflected on read | AC-F3-2 | P3 | `tests/behaviour/providers/jira-trap.test.ts`, `labels-replace-*.json` |
| TC-JIRA-002 | Custom fields normalize to typed data (ADR-0006) | AC-F3-2 | P3 | `tests/behaviour/providers/jira-trap.test.ts`, `custom-fields.json` |
| TC-JIRA-003 | Transitions read as data via `WorkflowMap` | AC-F3-2 | P3 | `tests/behaviour/providers/jira-trap.test.ts`, `transitions.json`, `workflow-map.json` |
| TC-JIRA-004 | Omitted comments distinguishable from empty (ADR-0006) | AC-F3-2 | P3 | `tests/behaviour/providers/jira-trap.test.ts`, `comments-{omitted,empty}.json` |
| TC-JIRA-005 | Owner hand-backs query family | AC-F3-1 | P3 | `tests/behaviour/providers/jira-queries.test.ts`, `tracker-queries.json#/owner-hand-backs` |
| TC-JIRA-006 | Blocked dependencies query family | AC-F3-1 | P3 | `tests/behaviour/providers/jira-queries.test.ts`, `tracker-queries.json#/blocked-dependencies` |
| TC-JIRA-007 | Stalls query family via `updatedAt` (absent = unknown) | AC-F3-1, AC-F1-2 | P1 (contract), P3 (behaviour) | `tests/behaviour/providers/jira-queries.test.ts`, `stalls.json` |
| TC-JIRA-008 | Ticket hygiene query family | AC-F3-1 | P3 | `tests/behaviour/providers/jira-queries.test.ts`, `tracker-queries.json#/ticket-hygiene` |
| TC-GITLAB-001 | MR reads normalize to `DeliveryRequest` | AC-F2-1 | P4 | `tests/behaviour/providers/gitlab-trap.test.ts`, `merge-requests.json` |
| TC-GITLAB-002 | Pipeline multiplicity per commit is truthful | AC-F2-1 | P4 | `tests/behaviour/providers/gitlab-trap.test.ts`, `pipelines-per-commit.json` |
| TC-GITLAB-003 | Async/multi-valued merge status not flattened | AC-F2-1 | P4 | `tests/behaviour/providers/gitlab-trap.test.ts`, `merge-status-{async,multivalued}.json` |
| TC-GITHUB-001 | PR reads normalize with review-state mapping | AC-F4-1 | P5 | `tests/behaviour/providers/github-trap.test.ts`, `pr-review-states.json` |
| TC-GITHUB-002 | Check runs per SHA map to `PipelineRun` | AC-F4-1 | P5 | `tests/behaviour/providers/github-trap.test.ts`, `check-runs-per-sha.json` |
| TC-GITHUB-003 | Issue reads map to `WorkItem` incl. `updatedAt` | AC-F4-1 | P5 | `tests/behaviour/providers/github-trap.test.ts`, `issues.json` |
| TC-GITHUB-004 | Complete status/verify input set from fixtures | AC-F4-1 | P5 | `tests/behaviour/providers/github-inputs.test.ts`, `tests/fixtures/providers/github/` |
| TC-CAP-001 | Capability declarations and declared gaps per client | AC-F1-1 | P6 (declarations authored P3–P5) | `tests/behaviour/provider-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts` |
| TC-CRED-001 | Credential-port-exclusive resolution; allowlist stays at four | AC-F7-1 | P6 | `tests/behaviour/provider-credentials.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/fixtures/secret-boundary/cases.ts` |
| TC-CRED-002 | Unresolvable credential classified | AC-F7-2 | P6 | `tests/behaviour/provider-credentials.test.ts`, `tests/behaviour/credential-port.test.ts` |
| TC-SURFACE-001 | No provider-native types cross the port surface | AC-F1-2 | P6 | `tests/structure/provider-surface.test.ts`, `tests/types/provider-views.type-test.ts` |
| TC-TRAP-001 | Trap catalog schema, coverage, data reviewability | AC-F5-1 | P7 (catalogs authored P3–P5) | `tests/structure/trap-catalog.test.ts`, `tests/fixtures/providers/traps/*.traps.json` |
| TC-TRAP-002 | Offline trap suite passes; negative control names its entry | AC-F5-2 | P3 (harness), P7 (controls) | `tests/behaviour/providers/*-trap.test.ts`, `tests/behaviour/providers/trap-harness.ts` |
| TC-FIXTURE-001 | Fixture sanitization audit and stable references | AC-F6-1 | P7 (fixtures authored P3–P5) | `tests/checks/fixture-sanitization.test.ts`, `tests/fixtures/providers/**` |
| TC-FIXTURE-002 | Sanitization canary catches a planted secret | AC-F6-1 | P7 | `tests/checks/fixture-sanitization.test.ts`, `tests/fixtures/providers/sanitization/cases.ts` |
| TC-LICENSE-001 | License registry stays complete under the chosen bases | NFR-6 | P10 (zero-dep constraint held P3–P5) | `tests/checks/license-audit.test.ts`, `scripts/checks/license-audit.ts`, `doc/legal/dependency-licenses.yaml` |
| TC-GATE-001 | Repository gate integrity and bash-stack immutability | NFR-7 | P10 (green at every phase boundary) | `package.json`, `.github/workflows/ci.yml`, existing `tests/structure/**`, `tests/checks/**` |
| TC-PLAN-001 | Implementation-basis evaluation recorded in the ticket | AC-F8-1 | P10 (verify-only — already recorded, comment 6536692124) | ticket GH-188 decision comment |

Ticket-AC traceability (spec §1/§24): trap tests pass against recorded fixtures → TC-TRAP-001/002 + all provider trap cases (P3–P5, P7); Jira read slice answers M0-S6 queries → TC-JIRA-005–008 (P3); GitHub read slice serves status/verify inputs → TC-GITHUB-001–004 (P5); no client reads a secret outside the credential port → TC-CRED-001/002, TC-FIXTURE-001/002, TC-BOUNDARY-001 (P2, P6, P7).

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification | [chg-GH-188-spec.md](./chg-GH-188-spec.md) | Source of requirements: F-1–F-8, DM-1–DM-8, NFR-1–NFR-7, DEC-1–DEC-8, §17 ACs, §18 DoD |
| Test plan | [chg-GH-188-test-plan.md](./chg-GH-188-test-plan.md) | Source of the 28 TC IDs, trap-catalog index, target layers, §7.2 gate handoff, §8.3 OQs resolved in Context above |
| PM notes | `./chg-GH-188-pm-notes.yaml` | Read-only orchestration context (autonomous delivery; recorded decisions) |
| This plan | `./chg-GH-188-plan.md` | Only file written by this authoring pass |
| ADR-0004 | [../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) | Governs P1 (`updatedAt`) |
| ADR-0005 | [../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) | Governs P2 (confinement admission) |
| ADR-0006 | [../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) | Governs P1/P3 (optional `comments`; DM-8 mapping) |
| Ticket decision comment | GH-188 comment 6536692124 | Implementation-basis outcomes (settled input; TC-PLAN-001 evidence) |
| Boundary config | `.dependency-cruiser.cjs` | P2 confinement entries + fixtures |
| Secret-read invariant | `scripts/checks/secret-read-boundary.ts` | Frozen at exactly 4 allowlist entries — never edited in this change |
| Credential implementation | `packages/adapters/src/credentials/index.ts` | `createProcessCredentialPort` used by production composition; clients receive an injected port |
| House-format precedent | [chg-GH-181-plan.md](../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-plan.md) | Phase structure, changeset convention, gate-battery ordering |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Layer-to-gate mapping, fixture rules |
| TS rules | [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) | Strict-TS, purity, ports/adapters patterns — read before editing |
| Release intent | `.changeset/gh-188-client-seeds-minor.md` (P10) | Five-package fixed group; no publishing here |
| System docs (post-delivery) | `doc/spec/features/**`, ADR-0003 pointer | Owned by the lifecycle doc-sync phase (`@doc-syncer`), not this change |

Protected paths untouched by every phase: `scripts/*.sh`, `scripts/checks/secret-read-boundary.ts`, `tools/`, `.opencode/`, `.ados-claude/`, bash CI jobs, `.github/workflows/ci.yml`.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31T14:30:00Z | Implementation Plan Writer | Initial ten-phase, 38-task plan: contract extensions (ADR-0004/0006) first, confinement admission (ADR-0005) second, then Jira → GitLab → GitHub seeds with per-client trap suites, cross-client honesty/credential/surface suites, catalog/sanitization discipline, review/fix phases, and finalize/release with the §18 DoD checklist; 12/12 AC and 28/28 TC mapping; test-plan §8.3 OQ-C..OQ-H resolutions recorded (incl. the OQ-G gap-reason table and OQ-D merge-status rule); implementation-basis evaluations referenced as settled inputs (ticket comment 6536692124), not re-executed. |
| 1.1 | 2026-10-31T12:00:00Z | Reviewer (review_fix phase) | Appended Phase P11 (Code Review Remediation, Iteration 1) from `code-review/review-iter-1.yaml`: verdict PASS (0 blocker / 0 major / 4 low / 4 info), all 12 ACs verified with independently re-run suites; remediation covers F-1 workflow-map comment typo, F-2 undocumented relative-io-import exception, F-3 GitHub closed→done state_reason limitation note, F-4 unknown-reviewDecision fallback declaration, plus the F-8 clean-tree requirement. |
| 1.2 | 2026-10-31T15:00:00Z | Coder (run-plan remediation) | Executed P11-1..P11-5 (`162e61e`): fixed the GH-188 header typo, documented the relative `../io` convention in the feature spec and transport header, declared `GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK` with an extended GH-REVIEW-STATE trap assertion, and recorded the GitHub `state_reason`/`not_planned` deferral plus the F-5 wording fix in the trap catalog. Finalized P10-1 (five-package minor changeset) and P10-4 (every §18 predicate marked with current evidence); reconciled P8/P9/P10-2 with `review-iter-1.yaml`; left the PR/CI predicate as an explicit lifecycle-phase-11 handoff because this run must not push. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-31T14:30:00Z | 2026-10-31T14:30:00Z | none | Read the completed spec (v1.3) and test plan (v1.2), PM notes, ADR-0004/0005/0006, the GH-181 house-format plan, and the live repo surfaces (core contracts, adapters subpaths/manifest, `.dependency-cruiser.cjs`, boundary harness/fixtures/registry, secret-read invariant, ambient-globals scope, changeset fixed group, test layout). Only this plan file written; no git/build/test operations. |
| P1 | Complete | 2026-10-31T02:15:00Z | 2026-10-31T02:40:00Z | a335093 | Contract extended additively; field-shape probe + type probes; `pnpm check` green. |
| P2 | Complete | 2026-10-31T02:41:00Z | 2026-10-31T03:05:00Z | 07a3834 | Three exact provider entries with reasons; boundary literal assertion, positive/negative fixtures, widening guard; `pnpm check` green. |
| P3 | Complete | 2026-10-31T03:06:00Z | 2026-10-31T04:10:00Z | 10dce1e | Jira read slice, 5-entry trap catalog, harness, four query families; `pnpm check` green. |
| P4 | Complete | 2026-10-31T04:11:00Z | 2026-10-31T05:05:00Z | a11bc53 | GitLab MR/pipeline reads, declared merge-status table with precedence, 3-entry trap catalog; `pnpm check` green. |
| P5 | Complete | 2026-10-31T05:06:00Z | 2026-10-31T06:00:00Z | efda29f | GitHub PR/check-run/issue reads, 3-entry trap catalog, complete status/verify input set; `pnpm check` green. |
| P6 | Complete | 2026-10-31T06:01:00Z | 2026-10-31T07:10:00Z | 9a136e3 | OQ-G honesty suite, credential-port exclusivity at 4 entries, provider-subpath planted reads, surface purity (AST + types); `pnpm check` green. |
| P7 | Complete | 2026-10-31T07:11:00Z | 2026-10-31T08:05:00Z | 409781d | Catalog schema/minima/reference suite, bidirectional coverage meta-check, per-client double replay, sanitization audit + canary; `pnpm check` green. |
| P8 | Complete | 2026-10-31T12:00:00Z | 2026-10-31T12:00:00Z | ef9462d | Independent review recorded `code-review/review-iter-1.yaml`: PASS (0 blocker/0 major/4 low/4 info), 12/12 ACs verified, suites independently re-run. |
| P9 | Complete (via P11) | 2026-10-31T14:30:00Z | 2026-10-31T15:00:00Z | 162e61e | Accepted low findings closed by P11; no blocker/major findings existed. Post-fix independent re-review waived by the explicit `no review` instruction for this remediation round; full gates re-run green. |
| P10 | Complete (PR handoff open) | 2026-10-31T08:06:00Z | 2026-10-31T15:00:00Z | chore commit (this revision) | P10-3 battery green at code HEAD `409781d`; P10-1 five-package minor changeset and P10-4 DoD checklist finalized in this revision. P10-2 doc-sync content landed in `4162c89`; P10-5/PR creation remains an explicit lifecycle-phase-11 handoff (not pushed here). |
| P11 | Complete | 2026-10-31T14:45:00Z | 2026-10-31T15:00:00Z | 162e61e | Four low findings closed (F-1..F-4) plus F-5 wording; `pnpm check` 806 pass / 0 fail; trap-catalog schema and GH trap suites green; working tree clean. |
