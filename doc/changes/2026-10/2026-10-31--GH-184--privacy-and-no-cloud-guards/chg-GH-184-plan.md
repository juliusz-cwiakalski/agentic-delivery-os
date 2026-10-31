---
id: chg-GH-184-privacy-and-no-cloud-guards
status: Proposed
created: 2026-10-31T07:05:00Z
last_updated: 2026-10-31T07:05:00Z
owners: [engineering]
service: delivery-os repository checks and metadata codec
labels: [change, planning]
links:
  change_spec: ./chg-GH-184-spec.md
  test_plan: ./chg-GH-184-test-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
  tdr_refs:
    - ../../../decisions/TDR-0005-privacy-and-no-cloud-guard-mechanics.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
  related_changes:
    - ../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-plan.md
    - ../2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-plan.md
summary: >-
  Deliver M0-S15 per spec v1.1 and TDR-0005: one privacy-literals repository
  invariant built from a pure shared rule module (seven committed generic rule
  definitions) and a schema-versioned hashed-literal registry (private-literal
  and cloud-term classes, fail-closed validation, caps, reason-bearing
  allowlist/exclusions), a working-tree-only no-history scan with content-free
  reporting and a stdin-only CI-refusing authoring mode, mutation and behaviour
  suites with detection-disabled and echo-enabled mutant controls, binding
  ts-invariants wiring plus a build-free local command with no aggregate change,
  a required injected pure content policy at serializeEnvelope with the
  content-policy-violation failure kind and all call sites updated, and exactly
  one new five-package minor changeset with pre-existing changesets untouched.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-184: M0-S15: Privacy and no-cloud guards

## Context and Goals

- **Work item**: GH-184 — M0-S15: Privacy and no-cloud guards. Execution belongs on `feat/GH-184/privacy-no-cloud-guards` (checked out); the PR targets `main-tools`.
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-184-spec.md](./chg-GH-184-spec.md) — **v1.1**: F-1..F-8, DM-1..DM-7, NFR-1..NFR-9, C-1..C-7, 22 ACs (AC-F1-1..AC-F8-1), §17 coverage note, §18 rollout order and Definition of Done.
  - [chg-GH-184-test-plan.md](./chg-GH-184-test-plan.md) — **v1.1** (34 TCs: TC-PRIVACY-001..021, TC-POLICY-001..008, TC-WIRE-001..003, TC-RELEASE-001..002); §4.1 in-process/spawned contract, §4.2 mutation-triple contract, §4.3 no-echo proof contract, §4.4 RV-01..RV-30 fail-closed matrix, §7 execution order and evidence battery.
  - [TDR-0005](../../../decisions/TDR-0005-privacy-and-no-cloud-guard-mechanics.md) — binding mechanics (one check + one registry authority, domain-separated unsalted SHA-256, no-echo reporting, hashed `cloud-term` class, required injected policy at the single serialization point, working-tree boundary, no config-layer key).
- **Status**: Proposed (awaiting DoR gate, lifecycle phase 5).
- **Baseline**: `main-tools` with M0-S1..S5, S10, S12, S19 merged; five unreleased changesets exist in `.changeset/` (`config-layer-minor.md`, `state-layer-minor.md`, `gh-181-primitive-ports-minor.md`, `pm-notes-lint-minor.md`, `gh-188-client-seeds-minor.md`) and must remain untouched.

**Goals** (spec §4, §17): a committed file containing a guarded literal fails binding CI · adding a guarded literal is a data-only registry edit · the no-cloud rule is enforced as hashed `cloud-term` entries with no raw term committed and a synthetic activation proof · violation output is content-free (id, file, line, fingerprint only) · `serializeEnvelope` takes a required injected pure content policy sharing the generic rules with the file check, returning the new fail-closed `content-policy-violation` failure · binding `ts-invariants` wiring plus a build-free local `check:privacy-literals` command, aggregate `check` byte-unchanged, no new CI job · exactly one new five-package minor changeset.

**Delivery model**: `@coder` executes Phases 1–7 in order, each ending in exactly one Conventional Commit (scope `GH-184`) and a green phase gate. Phases 8–11 map to lifecycle phases 7–11 and are PM-scheduled; `@coder` must not mark them complete by finishing implementation alone. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → (8–11 per lifecycle)**. The guard must be green on the clean tree at the end of Phase 2, before any CI wiring (Phase 5); the codec tightening (Phase 6) lands only after the guard and its suites are green (spec §18).

### Pinned delivery decisions (binding; changing any pin reopens this plan)

The test plan left placement and spelling decisions delivery-bound (A-T2, A-T3, OQ-T3, OQ-T4, OQ-T6; GAP-T1). Each pin below preserves the pinned semantics (behaviour, assertions, identities, AC mapping — A-T1) and only fixes location/spelling. OQ-T3 is the decision the tasking explicitly reserved to this plan.

- **PD-1 — Shared-rule module location and consumption (resolves OQ-T3, OQ-T6)**:
  - `packages/adapters/src/io/privacy-rules.ts` (new) — the one pure, dependency-free shared module (spec DEC-2, §16 "Adapter I/O tier: new pure rule-definition/policy module beside the envelope codec"). **Zero module imports**: no `node:*`/`bun:*`, no `@delivery-os/*`, not even core contracts — every type it needs is declared locally. Contents: the seven rule definitions as `as const` data (`id`, recognizer class, severity, pattern source + flags, minimum match length), the committed placeholder-suppression classes, `PRIVACY_HASH_DOMAIN` (`privacy.literal.v1`), `PRIVACY_FINGERPRINT_DOMAIN` (`privacy.fingerprint.v1`), `PRIVACY_CAPS` (the NFR-9 values as code data), `normalizeLiteral`, `privacyDigestInput`, the generic-rule matcher, the fixed-length candidate-window enumeration core, and `privacyFingerprint` (a pure FNV-1a-64 hex derivation, ≤ 16 lowercase hex characters, identifier-derived only — no crypto needed, keeping the module dependency-free).
  - `packages/adapters/src/io/envelope-content-policy.ts` (new, Phase 6) — the pure policy builder: `buildEnvelopeContentPolicy({ hash, entries })` returning the contract-typed policy; imports only `./privacy-rules.js` (in-package relative) and `import type { EnvelopeContentPolicy } from "@delivery-os/core/contracts"`. It does **not** export an allow-all policy (no default-open helper exists anywhere).
  - `scripts/checks/privacy-literals.ts` imports `../../packages/adapters/src/io/privacy-rules.js` by **relative path** (the established dev-edge precedent — root `tests/**` import `packages/adapters/src/io/envelope-codec` relatively; GH-181 plan DEC-9 records that root trees sit outside the `depcruise packages` cruise scope).
  - **Layering justification (verified against the live gates):**
    1. *dependency-cruiser*: the check script is outside the `depcruise packages` scope, so the relative `scripts/ → packages/adapters/src/io` edge is invisible to every rule; inside `packages/`, `privacy-rules.ts` has zero imports (no `runtime-apis-confinement` exposure — `packages/adapters/src/io/` is intentionally **not** in the runtime-API allowlist and stays out) and `envelope-content-policy.ts` adds only an in-package relative edge plus the already-declared `@delivery-os/core/contracts` edge (the codec's own import). No matrix, tier, subpath, or deep-import rule is touched; no new adapters subpath or `exports` entry (adapter-internal, like the codec).
    2. *ambient-globals / secret-read-boundary*: both modules are pure (no `process`, `Bun`, clock, randomness, environment, filesystem, network) — the adapters tree stays clean; `node:crypto` appears **only** in `scripts/checks/privacy-literals.ts` (the check edge) and in injected adapter composition at future emitters, never in the pure module or codec (C-4, C-5).
    3. *`ts-invariants` build ordering*: the `ts-invariants` job has **no build step** and package-name specifiers resolve through `exports` to `dist` (the exact hazard `scripts/checks/boundary-ci-parity.ts` exists to prevent for `ts-boundaries`). The relative source import keeps `bun run scripts/checks/privacy-literals.ts` runnable pre-build (AC-F7-2 build-free; TC-WIRE-002 step 3's import-graph assertion: no `dist/` path, no workspace package-name import, no external dependency).
    4. *Single definition set*: both consumers import the same module; no rule-id table exists anywhere else (TC-POLICY-005 step 3, TC-POLICY-006 step 2/5).
- **PD-2 — Registry shape** (`scripts/checks/privacy-literals.registry.json`, schema version `privacy.registry.v1`, mirroring the `delivery.registry.v1` naming precedent):
  - Top-level keys exactly: `schemaVersion`, `scopeMode`, `enabledRuleIds`, `classes`, `allowlist`, `exclusions`.
  - `scopeMode`: `"working-tree"` is the only supported value (tracked plus untracked-but-not-ignored); anything else fails closed (RV-03/RV-04).
  - `enabledRuleIds`: array that must set-equal the seven committed rule ids in `privacy-rules.ts`, with no duplicates (RV-05/RV-06/RV-10). Patterns are code, never data (spec DM-3).
  - `classes`: an object keyed by the two declared classes `private-literal` and `cloud-term`; each value is `{ "emptyReason": string | null, "entries": HashedEntry[] }`. An empty class requires a non-empty `emptyReason` (RV-09); a non-empty class must have `emptyReason: null`. Delivered content: `private-literal` with zero entries (owner populates after landing, OQ-1) and `cloud-term` empty with the written mechanism-only reason.
  - Entry: exactly `{ "id", "class", "algorithm", "hash", "length", "reason" }`; `algorithm` fixed to `"sha256"`; `hash` 64 lowercase hex; `length` integer 4–512 (normalized length); `reason` non-empty (DM-2).
  - Allowlist entry: `{ "id", "kind": "file" | "directory", "path", "reason" }` — repo-relative POSIX, no wildcards, no absolute or backslash forms, no trailing separator (RV-26); `kind: "directory"` is legal only for `tests/fixtures/privacy-literals` (the single directory-style entry; TC-PRIVACY-012 step 2). Exclusion entry: same shape with `kind: "file"` only.
  - **Caps are code, not registry data**: `PRIVACY_CAPS` in `privacy-rules.ts` fixes max 256 entries total, 128 per class, 32 distinct lengths, length 4–512, 64-hex digests, registry file ≤ 256 KiB (NFR-9). The registry cannot weaken them; any exceedance fails closed naming the bound (AC-F4-3).
  - Delivered allowlist (exact set, A-T7): `packages/adapters/src/io/privacy-rules.ts` (rule definitions and suppression data), `scripts/checks/privacy-literals.ts` (the check), `scripts/checks/privacy-literals.registry.json` (the registry), the guard's own test files as exact paths (`tests/checks/privacy-{literals,registry,scope,reporting,authoring,performance,ci-wiring,release}.test.ts`, `tests/behaviour/envelope-content-policy.test.ts`, `tests/structure/privacy-imports.test.ts`), and the directory entry `tests/fixtures/privacy-literals` — each with a written reason. Delivered exclusions: `pnpm-lock.yaml` (generated content, never hand-authored) and any further generated mirror discovered at baseline (see PD-8), each with a written reason.
- **PD-3 — Fail-closed validation order** (deterministic; the first failure is the reported failure; no scan result is emitted on any failure — AC-F4-1):
  1. registry file exists, parses as a JSON object, ≤ 256 KiB;
  2. `schemaVersion` present and exactly `privacy.registry.v1` (RV-01/02);
  3. `scopeMode` exactly `working-tree` (RV-03/04);
  4. `enabledRuleIds` array, no duplicates, exact set-equality with the committed rule ids (RV-05/06/10);
  5. `classes` exactly the two declared class keys; unknown keys rejected (RV-07/08); empty class ⇔ non-empty `emptyReason` (RV-09);
  6. entry shape, id non-empty (RV-11/20), unique ids (RV-12), unique digests with the same-length/inconsistent-length distinction (RV-13/14), `algorithm` = `sha256` (RV-15), digest shape (RV-16), length shape and range (RV-17/18), non-empty reason (RV-19);
  7. caps: totals, per-class, distinct lengths (RV-27..29 subsumed at validation; RV-30 at step 1);
  8. allowlist/exclusion entry shape, unique ids/paths, reason-bearing, path-form rules (RV-21..26); every allowlist entry matches a file in the enumerated scan set and every exclusion names an existing path (validated after file enumeration, before scanning);
  9. only then scan; validation failure ⇒ non-zero exit naming the field/entry id/bound, zero violations reported, no pass line.
- **PD-4 — Scan and reporting mechanics**: enumerate the working tree once via `git ls-files --cached --others --exclude-standard` from the repository root (no history reads; `.git`, ignored, and untracked-ignored content never enters the set); apply exclusions, then per-file binary detection (NUL byte or non-decodable leading window ⇒ skip, count, report — never silent); generic rules evaluate per line (1-based); hashed detection enumerates fixed-length candidate windows per distinct registered length over each text file, normalizing each window identically to entry building and skipping windows whose normalized length differs before digesting (linear per distinct length; NFR-5); violations sort by path → line → id; two runs are byte-identical; nothing is written. Output modes: human (default) and `--json` (machine), both content-free. Summary fields (both modes): `scannedFiles`, `binarySkipped`, `excludedFiles`, `allowlistedFiles`, `enabledRules`, `entriesByClass`, `distinctLengths`, `vacuousClasses` (class id + reason). Violation record: `{ ruleOrEntryId, file, line, fingerprint }` (DM-4). Exit codes: 0 green; 1 violations or fail-closed validation; 2 authoring-mode refusal (usage error, distinct from findings).
- **PD-5 — Authoring mode** (`--author`): reads the new literal from **stdin only** (never argv, never environment); prefers hidden terminal input when stdin is a TTY and accepts piped stdin for controlled local use; never echoes the literal or digest input; writes no file; refuses before reading input when `CI` (primary) or `GITHUB_ACTIONS` (secondary) is set in the environment, printing a refusal naming CI and exiting 2 (TC-PRIVACY-019). Input constraints: empty/whitespace-only or normalized length > 512 fails with a named failure and no digest emitted. Output: one JSON registry-entry-shaped record on stdout — `{"id": "<assign-entry-id>", "class": "<from --class, default private-literal>", "algorithm": "sha256", "hash": "<64 hex>", "length": <normalized length>, "reason": "<write-reason>"}` (DM-7). The digest is recomputable with the production helpers (TC-PRIVACY-018 step 3).
- **PD-6 — CI wiring (spec DEC-3)**: one additive line `bun run scripts/checks/privacy-literals.ts` appended inside the existing `ts-invariants` job's static-checks step — no new job, no removed base line (`ci-topology` additions-only diff guard), no `continue-on-error` or bypass construct (`ci-bindingness`), no bash job touched. `package.json` gains `check:privacy-literals` (`bun run scripts/checks/privacy-literals.ts`); the aggregate `check` string is **byte-unchanged** (`script-surface`, `tests/checks/ci-checks.test.ts` assert it). The new check needs no full history beyond the checkout the job already performs (working-tree-only scan), so no fetch step is added.
- **PD-7 — Live-tree baseline policy (the green gate)**: every false positive found by running the guard on the real clean tree is resolved either by tightening the rule definition (code, reviewed) or by a reason-bearing exact-path suppression/exclusion added to the registry (data, reviewed) — **never** by weakening a rule globally, disabling a rule id, or broadening suppression classes. Known baseline candidates: the generated `.ados-claude/**` plugin mirror (suppressible with the reason "generated mirror of `.opencode/**`, which is itself scanned"; suppress the mirror only, never the source), `pnpm-lock.yaml` (generated), and any committed absolute home/profile paths or documentation credential-shaped samples in specs/guides/change artifacts (prefer placeholder suppression classes and rule specificity first; exact-path suppression only where the content is genuinely safe). Every suppression added at baseline is enumerated in the phase-2 commit message for review.
- **PD-8 — Codec change shape**: `packages/core/src/contracts/envelope.ts` gains `ContentPolicyVerdict` (`{ ok: true } | { ok: false; ruleOrEntryId: string }`) and `EnvelopeContentPolicy` (the pure total function type from the exact compact JSON string to a verdict) — types only, joining the existing envelope contract surface (spec §16). In the codec: `SerializeEnvelopeInput` gains a required `policy: EnvelopeContentPolicy` member (no default, no overload, no optional fallback); `EnvelopeSerializationFailure` gains `"content-policy-violation"`; the denial result carries exactly one `ruleOrEntryId` and no content; validation order is closed payload → size bound → content policy (on the exact `JSON.stringify(envelope)` representation that would be embedded) → carrier construction; every failure path stays total and non-throwing. Existing `payload-not-closed` and `size-bound-exceeded` results are field-compatible and unchanged (DM-6, TC-POLICY-004). In-repo call sites updated in the same commit: `tests/structure/envelope-contract.test.ts`, `tests/behaviour/envelope-roundtrip.test.ts`, `tests/fixtures/ports/capabilities.ts` (the only current callers; `packages/adapters/src/io/index.ts` only re-exports) — each supplies a policy, assertions otherwise unchanged (diff shows only policy-supplying edits, TC-POLICY-002 step 2).
- **PD-9 — Changeset**: `.changeset/gh-184-privacy-guards-minor.md` (name delivery-bound; the `gh-<ref>-<slug>-minor.md` precedent) declaring `minor` for exactly the five fixed-group packages; the five pre-existing changesets are neither modified nor deleted; no manifest version is hand-edited; the lockfile is untouched (AC-F8-1, spec DEC-9).
- **PD-10 — Test-file authoring discipline**: every fixture value is fabricated with a synthetic canary; digests are computed at test time via the production helpers, never hand-copied (A-T8); mutation and echo-mutant modules are imported through temp file URLs (the `tests/golden/redaction.test.ts` pattern); temp trees live under `mkdtemp` siblings in the OS temp directory; the live tree stays read-only to every test.

### Spec/test-plan findings from this authoring pass

1. **TC-POLICY-005 step 1 wording vs the delivered codec** — the TC says the codec "imports only `import type` contract members", but the delivered `envelope-codec.ts` value-imports contract constants (`ENVELOPE_KINDS`, `ENVELOPE_MAX_BYTES`, `ENVELOPE_SCHEMA_ID`) — the established contract-consumption precedent, and NFR-6 (the operative purity NFR) lists no import-type-only clause. **This plan pins the reading**: contract *type* members via `import type` (as today), contract `as const` *data* members by value (as today), plus — if used — the pure shared module; zero `node:*`/`bun:*` imports and zero ambient references (the assertion's operative content). No TC behaviour, assertion target, or AC mapping is changed; flagged for `@readiness-reviewer` (DoR) to confirm. If the gate rejects the reading, the fallback is a follow-up question to `@pm` — never a silent reinterpretation.
2. **Test-plan §7 execution order vs codec landing** — step 1 lists TC-POLICY-005 first although the codec lands in Phase 6. Resolved by the established multi-phase TC-halves precedent (GH-174/GH-179): the definition-set/purity half of TC-POLICY-005 lands in Phase 1 over the shared module, the codec half in Phase 6. Mapped in the traceability table; no TC reshaped.
3. **Allowlist enumeration unpinned** — spec F-4 says "check/behaviour tests", TC-PRIVACY-012 says "guard test files"; PD-2 enumerates the exact delivered set so both readings coincide.

No other inconsistencies found; all 22 ACs and 34 TCs are covered below with no orphan TCs.

## Scope

### In Scope

- The pure shared rule module, its seven generic rule definitions, suppression classes, and shared matching core (F-1, DM-3; Phase 1).
- The schema-versioned registry, both hashed-entry classes, caps-as-code, and the reason-bearing allowlist/exclusions (F-2, F-3, F-4, DM-1, DM-2, NFR-9; Phase 1).
- The guard check: fail-closed validation, working-tree-only scan, binary skip reporting, content-free human/machine reporting, live-tree green baseline (F-4, F-5, NFR-1, NFR-2; Phase 2).
- The local authoring/hashing mode: stdin-only, no echo, no writes, CI refusal (F-5, DM-7; Phase 3).
- The guard mutation and behaviour suites TC-PRIVACY-001..021 with the mutation-triple and no-echo contracts (Phases 1 and 4).
- Binding `ts-invariants` wiring, the `check:privacy-literals` root script, and the wiring suites TC-WIRE-001..003 (F-7, NFR-7; Phase 5).
- The required injected pure content policy at `serializeEnvelope`, the `content-policy-violation` failure kind, all call-site updates, shared-rule parity, and the policy suites TC-POLICY-001..008 (F-6, DM-5, DM-6, NFR-6; Phase 6).
- Exactly one new five-package minor changeset, release-integrity suites, and the evidence artifact (F-8, NFR-8; Phase 7).
- Lifecycle gate phases 8–11 (review support, conditional remediation, doc-sync touch points, finalize/PR handoff).

### Out of Scope

- Any new package dependency, external scanner, secret manager, keyed hashing, salt, or key rotation (NG-1; C-5).
- A configuration-layer production key or any user-overridable weakening surface (NG-2; TDR-0005 §7).
- Git-history replay, corpus baselines, retroactive remediation (NG-3; AC-F4-2 asserts the boundary negatively).
- Scanning human-readable comment content at the emitter (NG-4; AC-F6-5) and binary/archive/encoded deep inspection (NG-7).
- A separate no-cloud script, job, or registry (NG-5); production emitters/provider adapters (NG-6); a new result-contract error row or domain mapping for the codec-local failure (NG-8; DEC-5).
- Owner-supplied private/hosted digests (OQ-1 — owner action after landing), the M3-S5 policy-engine placement (OQ-4), and any `doc/spec/**` authoring by `@coder` (lifecycle phase 7 / Phase 10 here; expected touch points are listed there, not tasked).
- Any edit to `.opencode/**`, `.ados-claude/**` sources, `.ai/**`, `scripts/*.sh`, `tools/**`, or the bash job set.

### Constraints

- **Purity and layering (PD-1)**: the shared rule module has zero imports; the policy builder imports only it and `import type` contract members; the codec gains no runtime import beyond the pure shared module if used; `node:crypto` lives only in the check script; `packages/adapters/src/io/` stays outside the runtime-API confinement allowlist.
- **No gate weakening (spec F-7, NFR-7)**: `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, `boundary-ci-parity`, `tests/checks/ci-checks.test.ts`, `tests/structure/content-inventory.test.ts`, `ambient-globals`, `secret-read-boundary`, and the boundary suite stay green **with their exact assertions unmodified** — extensions only add files, registrations, and fixtures. The aggregate `check` string and the `TS_JOBS`/`BASH_JOBS` lists are byte-unchanged; no new CI job.
- **Inventory discipline**: every new `packages/**` source file joins `tests/structure/inventory.json` and its executable exports join `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` in the same phase (GH-181 precedent).
- **No content in artifacts (C-1, C-6)**: no raw private literal, hosted-product term, real credential, salt, or key in any file this change writes; violation output and this plan stay content-free.
- **Testing discipline**: `bun:test` suites under `tests/<layer>/`; fixtures under `tests/fixtures/**` or `mkdtemp` temp roots; the spawned-process set is exactly the test plan §4.1 license; the mutation triple (§4.2) binds every rule/entry class and the echo-mutant control binds every no-echo assertion (§4.3).
- **Commits**: one Conventional Commit per phase, scope `GH-184`, bodies ≤ 100 chars; explicit staging lists; nothing from `.ai/local/`, `tmp/`, or untracked scratch is staged; `pnpm check` green before each phase commit (except where a check is structurally pre-wiring — none is: the privacy guard is never chained into `check`).
- **No license headers** on any file this change writes (change artifacts, `scripts/checks/**`, and package sources are header-free paths).
- **Strict TypeScript** per [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md); injected time/randomness/environment; the error contract is untouched (no new error-table row).

### Risks

Execution risks carried from the test plan (§8.1) and spec (§11), anchored to the phase/pin that mitigates them:

| ID | Risk | Impact | Probability | Mitigation (anchor) |
|----|------|--------|-------------|---------------------|
| RSK-E1 | Generic rules false-positive on real docs and erode the allowlist (spec RSK-2) | M | M | High-specificity thresholds tuned at the Phase 2 baseline; committed false-positive corpus; placeholder suppression classes; PD-7 never-weakens policy; every baseline suppression enumerated for review |
| RSK-E2 | The guard's own committed patterns/fixtures self-trip the scan (spec RSK-7) | H | M | PD-2 exact allowlist of the guard's own files with reasons; the fixture root is the only directory entry; allowlist entries must match a scanned path; growth only as reviewed data edits (TC-PRIVACY-012) |
| RSK-E3 | A suite is vacuous (fixture inert, echo assertion empty) (RSK-T1/T2) | H | M | §4.2 mutation triple + §4.3 echo-mutant proof in every suite; presence assertions before absence assertions (Phase 4) |
| RSK-E4 | Window hashing or a pathological pattern is superlinear (spec RSK-6, NFR-5) | M | M | Normalized-length pre-filter before digesting; caps (≤ 32 lengths, ≤ 512 length); bounded patterns (no nested unbounded quantifiers — pattern-shape lint); N/2N ratio suite (TC-PRIVACY-021) |
| RSK-E5 | The required policy breaks a call site or introduces a default-open path (spec RSK-5) | H | L | PD-8 updates all three call sites in the same commit; type probe makes omission a compile error; AST scan for defaults/overloads; single-serialization-point audit with a seeded second-path violation (TC-POLICY-002/005) |
| RSK-E6 | CI wiring weakens or duplicates a pinned assertion (RSK-T12) | H | L | PD-6 additive-only wiring; the five preserved validators plus `ci-checks.test.ts` run in the phase gate with exact assertions intact (TC-WIRE-001) |
| RSK-E7 | The changeset is misread as a total count and pre-existing metadata is touched (RSK-T9) | M | L | Spec v1.1 corrected AC-F8-1; TC-RELEASE-001 asserts the change diff both ways with modified/deleted pre-existing mutants (Phase 7) |
| RSK-E8 | A phase overruns its delegation window | M | M | `@coder` stops at the last green task boundary and reports; never enlarges or splits a phase commit |
| RSK-E9 | `private.absolute-user-path`/`secret.credential-assignment` fire on legitimate committed content (baseline discovery) | M | H | PD-7: tighten rule or exact-path suppress with reason; placeholder suppression classes for documentation samples; never a global weakening |

**Rollback strategy**: the change is additive except the intentional `serializeEnvelope` tightening — revert all phase commits as **one unit**. What must never be split: (a) core contract types + codec change + policy builder + all three call-site updates (any partial revert breaks compilation or opens a policy-less path); (b) the shared rule module + registry + allowlist + guard suites (the guard's own files are allowlisted, so orphaned allowlist entries would fail RV-21 on the rolled-back tree — the registry reverts with the check); (c) `ci.yml` wiring + the check script (topology fails on an invoked-but-missing check and on a check not invoked); (d) `inventory.json`/`EXECUTABLE_ALLOWANCES` registrations revert with the modules they register; (e) the changeset reverts with everything else. Never roll back only one side of the codec contract/type pair, and never leave the aggregate `check` string edited. After any rollback re-run `pnpm check`, `pnpm check:boundaries`, `bun run scripts/checks/ci-topology.ts`, and `bun run scripts/checks/forbidden-literals.ts` to confirm the baseline.

### Success Metrics

- 7/7 generic rules with positive, near-miss, and mutation cases; 2/2 hashed classes exercised by synthetic activation; 30/30 RV cells fail closed naming the field/entry id/bound (NFR-2, NFR-4, §4.4).
- 0 occurrences of any planted literal, content window, or digest input across stdout, stderr, machine output, failure objects, and authoring output — with echo-mutant proof the assertions can fail (NFR-3).
- Live tree green with a non-vacuous scope report (scanned > 0, rules = 7, per-class counts, vacuous classes named) and a planted-copy control that fires (TC-PRIVACY-020).
- 100% of serialization call sites pass a policy; 0 default-open paths; codec purity gates green; existing envelope suites green with only policy-supplying diffs (NFR-6).
- `ts-invariants` invokes the guard by name and fails on a planted value; `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, `ci-checks.test.ts` green and unweakened; local command build-free and offline (NFR-7).
- Exactly one new changeset × 5 packages minor; 0 modified/deleted pre-existing changesets; 0 version hand-edits; unchanged lockfile; 0 new dependencies; license audit green (NFR-8).

## Phases

### Phase 1: Shared pure rule module and the schema-versioned registry

**Goal**: Land the single source of truth for the generic rules and hashing vocabulary and the committed registry data, both consumable by the file check today and the emitter policy later — with structure/inventory gates green before any scan exists.

**Tasks**:

- [ ] **1.1** Author `packages/adapters/src/io/privacy-rules.ts` (PD-1): the seven `as const` rule definitions (`secret.provider-token-prefix`, `secret.private-key-block`, `secret.web-token`, `secret.bearer-credential`, `secret.credential-assignment`, `secret.connection-string-credential`, `private.absolute-user-path`) each carrying id, recognizer class, severity, pattern source + flags, and minimum match length; the placeholder-suppression classes (documentation placeholder, redaction marker, fabricated sample — data, not path inference); `PRIVACY_HASH_DOMAIN`, `PRIVACY_FINGERPRINT_DOMAIN`, `PRIVACY_CAPS`; `normalizeLiteral` (trim + lowercase — one normalization, used identically by entry building and window matching); `privacyDigestInput` (domain prefix + normalized literal); the generic-rule matcher (bounded patterns, no nested unbounded quantifiers); the fixed-length candidate-window enumeration core taking an injected digest function; `privacyFingerprint` (FNV-1a-64 hex, ≤ 16 chars). Zero module imports; pure functions only. (F-1, DM-3, DEC-2; feeds TC-PRIVACY-001 definition-set half, TC-POLICY-005 step 3, TC-POLICY-006.)
- [ ] **1.2** Commit `scripts/checks/privacy-literals.registry.json` (PD-2): schema `privacy.registry.v1`, scope `working-tree`, the exact seven enabled rule ids, and both classes shipped deliberately empty — `private-literal` with zero entries and an explicit non-empty `emptyReason` stating owner population after landing (OQ-1), `cloud-term` with zero entries and its explicit mechanism-only reason (an empty class requires a non-empty `emptyReason`; RV-09) — plus the PD-2 allowlist/exclusion entries with reasons. No raw literal anywhere in the file. (F-2, F-3, F-4, DM-1, DM-2, §19; feeds TC-PRIVACY-008/010..013.) Verify: hand-check the file against PD-2's key set and confirm the guard's Phase 2 validation accepts it as the valid control.
- [ ] **1.3** Register the new module: add `adapters/src/io/privacy-rules.ts` to `tests/structure/inventory.json` and its executable exports to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` (exact list: the rule constants, domains, caps, and pure functions). (Feeds TC-POLICY-005 step 5 inventory half.)
- [ ] **1.4** Author the definition-set and purity half of `tests/structure/privacy-imports.test.ts`: the enabled-id set equals the seven committed ids and each id is defined exactly once in the repository; the module has zero imports, zero ambient/clock/randomness references, exports only data and pure functions; a seeded `node:fs` import in a temp copy fails the purity assertion. (AC-F1-2 definition half, AC-F6-3 shared-module half, NFR-2/NFR-4; TC-POLICY-005 step 3, TC-POLICY-006 step 5.)
- [ ] **1.5** Verify layering: `pnpm build && pnpm check:boundaries` green (depcruise sees the new module; no rule extended); `bun run scripts/checks/ambient-globals.ts` green; `bun run scripts/checks/secret-read-boundary.ts` green; biome format clean. Record in the execution log that no boundary rule needed an edit (expected — zero-import module).

**Acceptance Criteria**:

- Must: one committed rule-definition set exists, pure and dependency-free, registered in the inventory with named allowances; the registry is committed with both classes explicitly declared and no raw content; all structure/boundary gates green.
- Should: rule thresholds are conservative at v1 (high specificity over recall) so the Phase 2 baseline tunes upward, not downward.

**Affected code areas**:

- `packages/adapters/src/io/privacy-rules.ts` (new)
- `scripts/checks/privacy-literals.registry.json` (new)
- `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated — allowances), `tests/structure/privacy-imports.test.ts` (new, first half)

**System docs to update**:

- none (the privacy-guard feature spec is lifecycle phase 7 / Phase 10)

**Tests**:

- `bun test tests/structure/privacy-imports.test.ts tests/structure/content-inventory.test.ts` → green.
- `pnpm build && pnpm check:boundaries`; `bun run scripts/checks/ambient-globals.ts`; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-184): add pure shared privacy rule module and hashed-literal registry`

---

### Phase 2: Guard check — fail-closed validation, working-tree scan, content-free reporting, live-tree green

**Goal**: The repository invariant itself: registry validation that fails closed, the bounded working-tree scan, no-echo reporting in both modes, and a guard that is green on the real clean tree before anything is wired into CI.

**Tasks**:

- [ ] **2.1** Author `scripts/checks/privacy-literals.ts` — registry loading and the PD-3 validation pipeline in the exact pinned order, each failure naming the schema version, scope mode, rule id, class, entry id, digest/algorithm/length field, allowlist/exclusion id, path form, or exceeded bound; validation failures emit zero violations and no pass line. Runtime built-ins (`node:fs`, `node:child_process` for `git ls-files`, `node:crypto`) live only here. (F-4, AC-F4-1, AC-F4-3; feeds TC-PRIVACY-010..013.) Verify: hand-edit a temp copy of the registry per RV-01..RV-30 shape classes and confirm each fails closed by name (spot-check at least RV-01, RV-04, RV-09, RV-13, RV-14, RV-21, RV-26; the full matrix lands in Phase 4).
- [ ] **2.2** Implement the working-tree scan (PD-4): `git ls-files --cached --others --exclude-standard` enumeration at the repository root; exclusions then allowlist applied by exact path (the fixture root by exact directory prefix); binary detection with counted, reported skips; per-line generic matching via the shared module; hashed-window detection per distinct registered length with the normalized-length pre-filter; deterministic ordering path → line → id; zero writes, zero network (import graph contains no network-capable module). (F-4, AC-F4-2, NFR-1; feeds TC-PRIVACY-014, TC-PRIVACY-015.) Verify: plant a synthetic value in an untracked temp-file copy of the tree scan root (temp fixture repo) and confirm detection; confirm `git status --porcelain` unchanged after runs.
- [ ] **2.3** Implement content-free reporting (PD-4): human and `--json` modes carrying only `{ ruleOrEntryId, file, line, fingerprint }` per violation plus the summary counts including explicit vacuous-class reporting; the fingerprint derives solely from the id under `PRIVACY_FINGERPRINT_DOMAIN`; no output path prints matched content, content windows, or digest inputs. (F-5, AC-F5-1, DM-4; feeds TC-PRIVACY-016/017.) Verify: plant a synthetic positive in a temp tree, capture stdout/stderr in both modes, assert the planted value is absent and id/file/line/fingerprint present.
- [ ] **2.4** **Live-tree green baseline (PD-7)**: run `bun run scripts/checks/privacy-literals.ts` against the real clean working tree; resolve **every** finding by tightening a rule definition or adding a reason-bearing exact-path suppression/exclusion (`.ados-claude/**` mirror handling per PD-7; `pnpm-lock.yaml` exclusion); re-run until exit 0 with non-vacuous scope (scanned files > 0, rules = 7, per-class entry counts, vacuous classes named). Enumerate every suppression added, with its reason, in the commit message. Never weaken a rule globally or remove a rule id. (AC-F3-1, AC-F1-2, NFR-2; TC-PRIVACY-020 behaviour.) Verify: two consecutive runs byte-identical; exit 0; `--json` summary fields populated.
- [ ] **2.5** Determinism/read-only self-check: run the guard twice in each mode on the clean tree and on a planted temp copy; assert byte-identical output, unchanged `git status --porcelain`, and identical exit codes. (AC-F4-4, NFR-1; TC-PRIVACY-015 behaviour.) Verify: recorded in the phase log with commands and output digests.
- [ ] **2.6** Confirm no gate regressed: `pnpm check` green (the guard is not in the aggregate, so nothing else sees it yet); `bun run scripts/checks/ci-topology.ts` still green (the new check name is not yet wired — ci-topology requires every `scripts/checks/*.ts` to appear in `package.json` or CI, so this phase must NOT leave the tree in that state at a commit boundary — see task 2.7).
- [ ] **2.7** Add the root script `check:privacy-literals: bun run scripts/checks/privacy-literals.ts` to `package.json` in this phase's commit (not Phase 5) so `ci-topology`'s wiring rule is satisfied from the first commit that ships the check; `pnpm check:privacy-literals` exits 0. (F-7 wiring half; TC-WIRE-002 step 1.)

**Acceptance Criteria**:

- Must: malformed/triggering registry data fails closed naming the field with no partial pass; the scan covers exactly tracked + untracked-not-ignored text files with reported binary skips; the clean real tree is green with a non-vacuous summary; no output channel echoes content; two runs byte-identical; `pnpm check` green.
- Should: the validation failure messages follow one stable prefix pattern (`FAIL privacy-literals: ...`) so Phase 4's "exactly one failure" assertions are precise.

**Affected code areas**:

- `scripts/checks/privacy-literals.ts` (new), `scripts/checks/privacy-literals.registry.json` (updated — baseline suppressions/exclusions only, with reasons)
- `package.json` (updated — one new script; aggregate `check` untouched)

**System docs to update**:

- none

**Tests**:

- `bun run scripts/checks/privacy-literals.ts` → exit 0 on the clean tree; `--json` twice → byte-identical.
- Temp-repo spot checks per tasks 2.1–2.3 (recorded in the log; the suites land in Phase 4).
- `bun run scripts/checks/ci-topology.ts`; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-184): add privacy-literals check with fail-closed registry validation and no-echo working-tree scan`

---

### Phase 3: Local authoring mode

**Goal**: The safe digest-production path that makes registry extension data-only: stdin-only, no-echo, no-write, CI-refusing.

**Tasks**:

- [ ] **3.1** Implement `--author` in `scripts/checks/privacy-literals.ts` (PD-5): CI detection (`CI` primary, `GITHUB_ACTIONS` secondary) checked before any input read, refusing with exit 2 and a message naming CI; stdin-only literal reading (hidden-terminal preference when TTY, piped stdin accepted; argv and environment never consulted as input channels); normalization and hashing through the shared module's helpers with `node:crypto` at this edge; output exactly the DM-7 record with id/reason placeholders; empty/whitespace-only and over-512 normalized-length inputs fail with a named failure and no digest; no repository writes. (F-5, AC-F5-2, DM-7; feeds TC-PRIVACY-018/019, AC-F2-2.)
- [ ] **3.2** `--class private-literal | cloud-term` flag (default `private-literal`) selecting the emitted record's class; the record is paste-ready for the registry. (DM-7; feeds TC-PRIVACY-005.) Verify: pipe a synthetic literal, parse the JSON output, insert it into a temp registry copy, plant the literal in a temp tree, and confirm the unchanged guard detects it (the Phase 4 suite automates this; do it manually once now).
- [ ] **3.3** No-echo self-check on the authoring path: with a synthetic literal piped in, assert stdout/stderr contain neither the literal nor the digest input; assert `git status --porcelain` unchanged; assert the digest matches independent recomputation via the shared helpers. (NFR-3; TC-PRIVACY-018 behaviour.)
- [ ] **3.4** Confirm the guard stays green and unchanged: `bun run scripts/checks/privacy-literals.ts` exit 0; `pnpm check` green; biome format clean.

**Acceptance Criteria**:

- Must: the authoring mode refuses under either CI marker before reading input, works without them, never echoes the literal or digest input, writes nothing, and emits a registry-entry-shaped record with placeholders.
- Should: the refusal message and input-failure messages name their cause in one line each (stable prefixes for Phase 4 assertions).

**Affected code areas**:

- `scripts/checks/privacy-literals.ts` (updated)

**System docs to update**:

- none

**Tests**:

- `printf '<synthetic>' | bun run scripts/checks/privacy-literals.ts --author` → record, no echo; `CI=true ... --author` → exit 2 refusal; `GITHUB_ACTIONS=true ... --author` → exit 2 refusal.
- `bun run scripts/checks/privacy-literals.ts` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-184): add stdin-only no-echo authoring mode with CI refusal to privacy guard`

---

### Phase 4: Guard mutation and behaviour suites (TC-PRIVACY-001..021)

**Goal**: Prove the guard non-vacuous and fail-closed: the full rule/class mutation triples, the 30-cell registry matrix, scope/determinism/reporting/fingerprint/authoring suites, live-tree green with a planted-copy control, and the performance budgets — all discovered by `bun test`.

**Tasks**:

- [ ] **4.1** Author `tests/fixtures/privacy-literals/rules.ts` and `corpus/**` (PD-10): seven fabricated positives (one per rule, each with a synthetic canary, each matching exactly one class), one near-miss per rule sharing the discriminating prefix/shape, the suppression-class fixtures (placeholder, redaction marker, fabricated sample; plus one mixed file with an adjacent real-shaped positive on the same line), and the false-positive corpus of prose/documentation/code-sample/change-artifact-shaped text. No real credential, path, or product term. (NFR-2; TC-PRIVACY-002/003 preconditions.)
- [ ] **4.2** Author `tests/checks/privacy-literals.test.ts` — TC-PRIVACY-001 (single-plant per rule: exactly one violation with id/file/line/fingerprint, non-zero exit; multi-plant: 7 sorted unique violations; detection-disabled mutant reports zero while presence holds), TC-PRIVACY-002 (corpus silent; near-misses silent; threshold-extension and over-broad-threshold-removal mutants caught), TC-PRIVACY-003 (suppression narrow and non-vacuous; suppression-disabled mutant caught; out-of-class value not accepted), the definition-set assertions from Phase 1 completed for the scan surface. Import the production check and shared module; temp trees via `tests/checks/fixture-repo.ts` extended per §4.1 (git for history/untracked/ignored/binary/exclusion fixtures).
- [ ] **4.3** Author the hashed-entry suites in the same file — TC-PRIVACY-004 (synthetic `private-literal` entry computed at test time: detection, fingerprint ≠ digest, removal clears, entry-removal control, disabled-mutant control), TC-PRIVACY-005 (authoring-produced entry pasted as data into a temp registry: detection with no code change; check/module digests identical before/after; import graph has no `dist/` and no package-name import; temp-clone/archive probe of HEAD detects the same literal), TC-PRIVACY-006 (case/whitespace variants detected with the same fingerprint; non-matching variants silent; two runs identical; normalization single-sourced; case-fold mutant caught), TC-PRIVACY-007 (lengths 4/5/7/16/64/512; prefix/substring pairs; file-start/end/newline-adjacent/punctuation-adjacent placements; short file; distinct-length set exactly derived; negative controls), TC-PRIVACY-008 (production `cloud-term` empty with reason; live guard reports the class vacuous by id; malformed RV-09 control), TC-PRIVACY-009 (synthetic cloud-term activation and entry removal; class summary flips non-vacuous/vacuous; direct text search proves the synthetic term exists only inside the allowlisted fixture root; disabled mutant caught).
- [ ] **4.4** Author `tests/checks/privacy-registry.test.ts` + `tests/fixtures/privacy-literals/registry.ts` — TC-PRIVACY-010/011/012/013: the full RV-01..RV-30 matrix materialized from the live registry in temp trees (each cell: non-zero exit, exactly one named failure, no pass line, zero violations; malformation-plus-planted-violation reports only the registry failure; valid control green; neighbouring-entry non-blame; caps at exact boundaries accepted and one-past rejected naming the bound; allowlist exactness incl. inside-vs-outside fixture root and counted allowlisted spans; validation-short-circuit, permissive-shape, and prefix-match mutants caught).
- [ ] **4.5** Author `tests/checks/privacy-scope.test.ts` — TC-PRIVACY-014: the temp git repository with history-only, untracked-not-ignored, ignored, tracked, binary, and excluded planted values; `git show` proves the history fixture live; ignored path absent from the scanned list; binary skip counted and named; exclusion honored and reasonless rejected (RV-25); file list order-independent across two materialization orders.
- [ ] **4.6** Author `tests/checks/privacy-reporting.test.ts` — TC-PRIVACY-015 (byte-identical replays both modes; content/mode snapshot and `git status --porcelain` unchanged; import graph free of network-capable modules; throwing `fetch`/spawn stubs; spawn recorder shows only licensed children; writing mutant caught), TC-PRIVACY-016 (three violation kinds in both modes; recursive machine-doc walk; candidate windows from file bodies and digest inputs absent; hex-string inventory rule; line-1 case prints no excerpt; echo-enabled mutant caught), TC-PRIVACY-017 (fingerprint ≤ 16 chars, documented charset, id-stable across files/lines/contents/registries/runs, distinct over the id set, content-independent).
- [ ] **4.7** Author `tests/checks/privacy-authoring.test.ts` — TC-PRIVACY-018/019 (spawned invocations with piped stdin and a controlled environment: record shape and field exactness, no echo, recompute equality, tree snapshot unchanged, empty/over-512 failures without digest, echo mutant caught; CI-marker refusal both signals with the no-marker positive control; argv and env channels never used and never echoed) — and `tests/checks/privacy-performance.test.ts` + `tests/fixtures/privacy-literals/performance.ts` — TC-PRIVACY-021 (deterministic corpus under 50 MiB exercising every registered length; N/2N ratio within slack; pathological near-miss corpus within budget; pattern-shape lint over committed definitions; policy-free envelope measurement placeholder excluded here — the emitter budget lands in Phase 6; medians recorded, not dropped) — then run `bun test` and `pnpm check` and confirm every new suite is discovered with a pass count > 0. Add the PD-2 exact-path allowlist entries for any new guard test file in the same commit.

**Acceptance Criteria**:

- Must: 21/21 TC-PRIVACY scenarios green with every mutant control caught; the RV matrix is 30/30 fail-closed; the live tree is green with the planted-copy control firing; `bun test` discovers all new suites; `pnpm check` green.
- Should: suite runtime stays well under the CI budget (temp trees per test, no live-tree writes, generous but bounded corpora).

**Affected code areas**:

- `tests/checks/privacy-{literals,registry,scope,reporting,authoring,performance}.test.ts` (new), `tests/checks/fixture-repo.ts` (updated — history/untracked/ignored/binary/exclusion extensions), `tests/fixtures/privacy-literals/{rules.ts,registry.ts,activation.ts,performance.ts,corpus/**,echo-mutants/**}` (new), `scripts/checks/privacy-literals.registry.json` (updated — exact-path allowlist entries for the guard's own new test files, reasons included)
- Conditional: `packages/adapters/src/io/privacy-rules.ts` threshold tightening discovered by the corpus (rule definitions only — never a rule-id removal)

**System docs to update**:

- none

**Tests**:

- `bun test tests/checks/privacy-literals.test.ts tests/checks/privacy-registry.test.ts tests/checks/privacy-scope.test.ts tests/checks/privacy-reporting.test.ts tests/checks/privacy-authoring.test.ts tests/checks/privacy-performance.test.ts` → green.
- `bun test` → all layers green; `pnpm check` → exit 0; `git status --porcelain` clean.

**Completion signal**: `test(GH-184): add privacy guard mutation, registry matrix, scope, reporting, authoring, and performance suites`

---

### Phase 5: Binding CI wiring and the preserved gates (TC-WIRE-001..003)

**Goal**: The guard becomes a binding `ts-invariants` invocation with the local command proven offline and build-free — with every pinned CI assertion green and unweakened, no new job, and the aggregate byte-unchanged.

**Tasks**:

- [ ] **5.1** Add one line `bun run scripts/checks/privacy-literals.ts` to the `ts-invariants` job's static-checks step in `.github/workflows/ci.yml` (PD-6: additive only; no base line removed; no `continue-on-error`; no new job; no bash change; no fetch step — the scan is working-tree only). (F-7, AC-F7-1 wiring; TC-WIRE-001 steps 1–2.) Verify: `git diff --unified=0 origin/main-tools...HEAD -- .github/workflows/ci.yml` shows additions only.
- [ ] **5.2** Author `tests/checks/privacy-ci-wiring.test.ts` — TC-WIRE-001: the `ts-invariants` step list contains the guard command by name; no bypass constructs; workflow additions-only against `origin/main-tools`; the aggregate `check` string is unchanged and does not chain the privacy check; `TS_JOBS`/`BASH_JOBS` unchanged; temp-workflow mutation controls (invocation removed, `continue-on-error` added, bypass added, new job added) each fail the named validator; failure propagation — the guard command run on a planted temp copy exits non-zero naming the violation and exits 0 on the clean tree. (NFR-7.)
- [ ] **5.3** Complete TC-WIRE-002 in the same suite: `package.json` declares `check:privacy-literals` (landed Phase 2) and the aggregate does not reference it; `pnpm check:privacy-literals` on the clean tree exits 0 with the required counts; build-free proof via the import graph (no `dist/`, no package-name import, no external dependency) corroborated from a temp clone/archive of HEAD; offline via import graph plus a throwing `fetch` stub; read-only and deterministic; planted-copy negative control. (AC-F7-2.)
- [ ] **5.4** Complete TC-WIRE-003: `ts-test` runs `pnpm test`; `bunfig.toml` discovery covers the new suites and its ignore patterns exclude none of them; each new suite runs explicitly with a pass count > 0; a deliberately failing temp test file fails `bun test` with the file and assertion named; no bypass construct in the job or script. (AC-F7-3.)
- [ ] **5.5** Run the preserved-gate battery and record results: `bun run scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain,script-surface,boundary-ci-parity}.ts`, `bun test tests/checks/ci-checks.test.ts`, then `pnpm check` — all green with exact assertions unmodified (diff review: no weakened assertion anywhere). (AC-F7-1 preserved half.)

**Acceptance Criteria**:

- Must: the guard is invoked by name in the binding job and a planted value fails the command; topology, bindingness, supply-chain, script-surface, boundary-ci-parity, and `ci-checks.test.ts` green with zero assertion edits; the aggregate string byte-unchanged; the local command proven offline, build-free, read-only, deterministic.
- Should: the wiring suite's job-block parsing reuses the `jobBlock` helper pattern from `ci-checks.test.ts` (consistency, not coupling).

**Affected code areas**:

- `.github/workflows/ci.yml` (updated — one additive line in `ts-invariants`)
- `tests/checks/privacy-ci-wiring.test.ts` (new)

**System docs to update**:

- none (the scaffold/toolchain spec's check inventory is reconciled in Phase 10)

**Tests**:

- `bun test tests/checks/privacy-ci-wiring.test.ts tests/checks/ci-checks.test.ts` → green.
- `bun run scripts/checks/ci-topology.ts && bun run scripts/checks/ci-bindingness.ts && bun run scripts/checks/ci-supply-chain.ts && bun run scripts/checks/script-surface.ts && bun run scripts/checks/boundary-ci-parity.ts` → exit 0.
- `pnpm check:privacy-literals` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `ci(GH-184): wire privacy-literals into ts-invariants with local command and preserved gates`

---

### Phase 6: Required codec content policy and the new serialization failure (TC-POLICY-001..008)

**Goal**: The metadata half: a required, injected, pure content policy at the single serialization point, sharing the generic rules with the file check, with every call site updated, codec purity preserved, and the existing envelope behaviour green.

**Tasks**:

- [ ] **6.1** Add the contract types to `packages/core/src/contracts/envelope.ts`: `ContentPolicyVerdict` and `EnvelopeContentPolicy` — types only, no runtime behaviour; export from `contracts/index.ts` unchanged surface discipline (existing exports gain only the two type names); update `EXECUTABLE_ALLOWANCES` only if new `as const` data is added (none expected). (DM-5, spec §16; feeds TC-POLICY-002/005.) Verify: `bun test tests/structure/envelope-contract.test.ts` and content-inventory green.
- [ ] **6.2** Author `packages/adapters/src/io/envelope-content-policy.ts` (PD-1): `buildEnvelopeContentPolicy({ hash, entries })` combining the shared generic rules with the injected hashed entries via the injected pure hash function over `privacyDigestInput`-derived windows; total, non-throwing, no I/O; returns the contract-typed policy. No allow-all export. Register in inventory + allowances. (F-6, DM-5; feeds TC-POLICY-008.) Verify: purity half of `privacy-imports.test.ts` extended to this module (imports only `./privacy-rules.js` + `import type` contract member; zero ambient).
- [ ] **6.3** Tighten the codec (`packages/adapters/src/io/envelope-codec.ts`, PD-8): required `policy` member on `SerializeEnvelopeInput`; `"content-policy-violation"` joins `EnvelopeSerializationFailure`; the denial result carries exactly one `ruleOrEntryId` and no carrier and no content; validation order closed payload → size bound → policy over the exact `JSON.stringify(envelope)` string → carrier; every path total. Existing failure kinds and fields unchanged. (F-6, AC-F6-1, DM-6.) Verify: focused order checks with a recording policy (invoked exactly once, only after closed+size pass, with the exact embedded representation).
- [ ] **6.4** Update all in-repo call sites in the same commit: `tests/structure/envelope-contract.test.ts`, `tests/behaviour/envelope-roundtrip.test.ts`, `tests/fixtures/ports/capabilities.ts` — each supplies a policy (inline clean policy or the builder with empty entries); assertions otherwise unchanged; the diff shows only policy-supplying edits. Confirm via AST/call-site scan that no other caller exists and every caller passes a policy, with a seeded call-site violation failing the scan. (NFR-6, TC-POLICY-002 step 5.)
- [ ] **6.5** Author `tests/behaviour/envelope-content-policy.test.ts` + `tests/fixtures/privacy-literals/envelopes.ts` — TC-POLICY-001 (guarded payload denied in each of the four payload string fields × all three carriers; one id; no carrier; no echo; escaped-JSON denial with the recorded input equal to `JSON.stringify(envelope)`; clean control), TC-POLICY-003 (recording policy over the five-case order matrix; no-throw sweep; no carrier of any kind on denial; escaping equivalence), TC-POLICY-004 (three-literal failure union; legacy kinds byte-compatible; failure keys exact; no content in any variant; existing suites pass with original assertions), TC-POLICY-007 (human content preserved byte-for-byte across carriers; policy input excludes human content; widening mutant caught), TC-POLICY-008 (both entry classes deny with the entry id; fixed-hash stub yields no match; empty entries serialize; namespace-collision rule), and the emitter half of TC-POLICY-006 (shared-rule parity: per paired rule class the file scan and the policy report the same id; id-rename mutation propagates to both; no remapping table; static id scan). Add the PD-2 exact-path allowlist entry for the behaviour test file in the same commit.
- [ ] **6.6** Author `tests/types/envelope-policy.type-test.ts` (registered in `tests/types/tsconfig.json`): a call omitting the policy is a compile error; a non-contract policy shape is a compile error; no overload accepts a policy-less input. Extend `tests/structure/envelope-contract.test.ts` with the required-member AST scan (no default parameter, no overload, no fallback branch constructing a carrier without a policy) and the single-serialization-point audit (exactly one envelope serializer; seeded second-path violation caught). (AC-F6-2 typing/structural halves.)
- [ ] **6.7** Close purity and boundary gates (TC-POLICY-005 codec half): `privacy-imports.test.ts` asserts the codec's import surface per PD-1 finding #1 (contract types via `import type`, contract `as const` data by value, the pure shared module, nothing else; 0 `node:*`/`bun:*`; 0 ambient/clock/randomness/filesystem/network; policy and hash arrive as injected typed inputs; no default hash implementation); seeded `node:fs` import in a temp codec copy fails; then run `pnpm build && pnpm check:boundaries`, `bun run scripts/checks/ambient-globals.ts`, `bun run scripts/checks/secret-read-boundary.ts`, `bun test tests/behaviour tests/structure tests/boundaries`, and `pnpm check`.

**Acceptance Criteria**:

- Must: omitting the policy cannot compile; a guarded payload returns `content-policy-violation` with one id and no carrier across every field/carrier; the existing round-trip, degradation, and write-path suites are green with only policy-supplying diffs; codec purity and boundary gates green; the guard remains green with the new allowlisted behaviour test (`bun run scripts/checks/privacy-literals.ts` exit 0).
- Should: the recording-policy harness is shared between TC-POLICY-001/003/007 (one helper, no duplication).

**Affected code areas**:

- `packages/core/src/contracts/envelope.ts` (updated — two types), `packages/adapters/src/io/envelope-content-policy.ts` (new), `packages/adapters/src/io/envelope-codec.ts` (updated), `packages/adapters/src/io/index.ts` (updated — re-export the builder, type-only additions)
- `tests/behaviour/envelope-content-policy.test.ts`, `tests/types/envelope-policy.type-test.ts`, `tests/structure/privacy-imports.test.ts`, `tests/structure/envelope-contract.test.ts`, `tests/behaviour/envelope-roundtrip.test.ts`, `tests/fixtures/ports/capabilities.ts`, `tests/fixtures/privacy-literals/envelopes.ts` (new/updated), `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (allowances), `scripts/checks/privacy-literals.registry.json` (one exact-path allowlist entry with reason)
- `tests/types/tsconfig.json` (updated — new probe file)

**System docs to update**:

- none (result-contract spec untouched — no error row is added, DEC-5)

**Tests**:

- `bun test tests/behaviour/envelope-content-policy.test.ts tests/behaviour/envelope-roundtrip.test.ts tests/behaviour/envelope-degradation.test.ts tests/behaviour/envelope-write-path.test.ts tests/structure tests/boundaries` → green.
- `pnpm typecheck` (compiles the probe; pretypecheck builds); `pnpm build && pnpm check:boundaries`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/secret-read-boundary.ts`.
- `bun run scripts/checks/privacy-literals.ts` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-184): require injected pure content policy at envelope serialization with content-policy-violation failure`

---

### Phase 7: Release changeset, release-integrity suites, and evidence

**Goal**: Exactly one new five-package minor changeset with pre-existing release metadata untouched, proven by suites that read the change diff — plus the delivery evidence artifact and the working-HEAD battery.

**Tasks**:

- [ ] **7.1** Author `.changeset/gh-184-privacy-guards-minor.md` (PD-9): frontmatter exactly the five fixed-group packages at `minor` (testkit absent); a non-empty body describing the privacy guard and the serialization-contract tightening. Do not touch the five pre-existing changesets, any manifest version, or the lockfile. (F-8, AC-F8-1, DEC-9.) Verify: `git status --porcelain` shows only the one new file under `.changeset/`.
- [ ] **7.2** Author `tests/checks/privacy-release.test.ts` — TC-RELEASE-001 (change diff over `.changeset/` shows exactly one added entry, zero modified, zero deleted; every pre-existing changeset byte-identical to `origin/main-tools`; the added frontmatter is exactly the five packages at minor; `changesets-group` green; testkit/missing/patch/second-added/modified/deleted mutants each caught) and TC-RELEASE-002 (all five manifests + testkit still `0.0.0`; no changed `version` line in the diff; `git diff --exit-code origin/main-tools...HEAD -- pnpm-lock.yaml`; `pnpm install --frozen-lockfile` succeeds; dependency key sets unchanged against base; `license-audit` green; `exports-parity`/subpaths green). (NFR-8.)
- [ ] **7.3** Author `chg-GH-184-evidence.md` in this change folder (GH-172/174/179 pattern): per-phase commits and green criteria, the consolidated gate battery with commands and HEAD, the 34-TC coverage map, the baseline suppression inventory from Phase 2 with reasons, the recorded NFR-5 local measurements, and rollback instructions (this plan's rollback section).
- [ ] **7.4** Run the full working-HEAD battery and record results: `pnpm install --frozen-lockfile`, `pnpm build`, every focused suite from the traceability table, `bun test`, `pnpm check`, `pnpm check:privacy-literals`, the preserved validators, `changesets-group`, `license-audit`, `forbidden-literals`, `manifest-privacy`, `ambient-globals`, `secret-read-boundary`, `workspace-entrypoints`, `boundary-ci-parity`, `git diff --check`, `git status --porcelain` (clean). `bash scripts/.tests/test-doc-distribution.sh` only if any guide/template changed (none expected).
- [ ] **7.5** Confirm change-level DoD predicates (spec §18): all 22 ACs have traceable evidence; the guard fires on every mutation case and stays green on the clean tree; no output contains planted content; the registry matrix fails closed 30/30; the `cloud-term` class is explicitly vacuous with synthetic activation firing; every serialization call site passes a policy and purity gates pass; the changeset is present with pre-existing metadata intact; all existing binding gates green.

**Acceptance Criteria**:

- Must: exactly one new changeset (five packages, minor); zero pre-existing changeset modifications/deletions; no version hand-edit; unchanged lockfile; license audit green; the release suites catch every mutation; evidence complete and honest (no unrun result recorded as passing).
- Should: the changeset body names both halves of the change (guard + codec policy) in the house style of the existing changesets.

**Affected code areas**:

- `.changeset/gh-184-privacy-guards-minor.md` (new), `tests/checks/privacy-release.test.ts` (new), `chg-GH-184-evidence.md` (new)

**System docs to update**:

- none

**Tests**:

- `git diff --name-status origin/main-tools...HEAD -- .changeset/` → one `A` line; `git diff --diff-filter=MD --exit-code origin/main-tools...HEAD -- .changeset/` → clean.
- `bun test tests/checks/privacy-release.test.ts`; `bun run scripts/checks/changesets-group.ts`; `bun run scripts/checks/license-audit.ts`; `pnpm install --frozen-lockfile`; `pnpm check` → green.

**Completion signal**: `chore(GH-184): add five-package minor changeset with release-integrity suites and delivery evidence`

---

### Phase 8: Independent review support (lifecycle phase 8 — review_fix inputs; PM-scheduled, NOT `@coder`-executed)

**Goal**: Hand `@reviewer` a complete, reproducible audit package; read-only analysis of Phases 1–7; no new code, no new TCs.

**Tasks**:

- [ ] **8.1** Consolidate the review input pack: per-phase commit list (the seven completion signals), per-phase green criteria with captured `pnpm check` logs, the 34-TC coverage map, and the pinned-decision index (PD-1..PD-10) including the TC-POLICY-005 reading pin (finding #1) for explicit reviewer confirmation.
- [ ] **8.2** Produce the scope and protected-path proof: the change diff touches no `.opencode/**`, `.ados-claude/**` source, `.ai/**`, `scripts/*.sh`, `tools/**`, or unpinned CI surface beyond the one additive `ts-invariants` line; each phase's staged set matched its Files-and-modules list.
- [ ] **8.3** Record the verdict in `review/review-iter-1.md` (GH-174/179 pattern); implementation findings route to Phase 9; any challenge to a PD pin or the finding-#1 reading routes to PM/`@decision-advisor` — never a silent alternative.

**Acceptance Criteria**:

- Must: a traceable PASS or actionable findings against spec, test plan, and this plan; no fabricated evidence.

**Affected code areas**: none (read-only). **System docs to update**: none.

**Tests**: no new TCs; the reviewer re-runs questionable evidence via the recorded commands.

**Completion signal**: independent verdict recorded; PASS advances to Phase 10 with Phase 9 not-required, findings activate Phase 9. (No code commit; PM-scheduled gate.)

---

### Phase 9: Post-review remediation (conditional; lifecycle phase 8 loop; PM-scheduled)

**Goal**: Close accepted review or gate findings without expanding scope; skipped with an explicit not-required record when Phase 8 returns PASS.

**Tasks**:

- [ ] **9.1** If findings exist: reproduce each through the relevant TC fixture or negative control first, then apply the smallest fix; behaviour outside the accepted guard/policy slice stays unchanged; a false-positive finding follows PD-7 (tighten or exact-path suppress — never weaken).
- [ ] **9.2** Fix code, fixtures, and registry data together; any accepted PD-pin change is recorded as a plan revision — never applied silently; the codec contract pair and call sites never split.
- [ ] **9.3** Re-run the affected focused suites, the full `pnpm check` battery, `pnpm check:privacy-literals`, and the independent re-review until PASS; if no findings, record this phase not-required backed by the Phase 8 PASS.

**Acceptance Criteria**:

- Must: all accepted findings closed with the affected ACs still traceable and previously green suites still green; no waived check.

**Affected code areas**: only affected Phase 1–7 files and their regression tests. **System docs to update**: lockstep with code if behaviour changed.

**Tests**: reproduce the failing TC cases and controls; re-run the full evidence set before finalization.

**Completion signal**: `fix(GH-184): <finding remediation>` per accepted batch, or an explicit not-required record. (Conditional; PM-scheduled.)

---

### Phase 10: Documentation and spec synchronization (lifecycle phase 7 — system_spec_update; `@doc-syncer`; PM-scheduled)

**Goal**: Reconcile `doc/spec/**` with the delivered guard and codec policy. `@coder` does not author system specs; the expected touch points are listed for the doc-syncer and the PR description.

**Tasks**:

- [ ] **10.1** New feature spec `doc/spec/features/feature-privacy-guard.md` describing the delivered surface (rule classes, registry schema and caps, validation order, working-tree boundary, no-echo reporting, authoring mode, CI wiring, the registry-as-data extension path); register it in `scripts/checks/forbidden-literals.registry.json` in the same change (GH-173/174/179 precedent). No `ados_distribution` marker (`doc/spec/**` is outside the distribution guard's scope).
- [ ] **10.2** `doc/spec/features/feature-adapter-ports.md`: the required content policy at `serializeEnvelope`, the `content-policy-violation` failure kind, the validation order, and the codec purity statement.
- [ ] **10.3** `doc/spec/features/feature-branding-seam.md`: the registry-as-authority precedent extended by the hashed-literal registry (hashed classes beside the raw public-token registry).
- [ ] **10.4** `doc/spec/features/feature-monorepo-scaffold-toolchain.md`: the check inventory gains `privacy-literals` (invoked in `ts-invariants`, local `check:privacy-literals`, deliberately outside the aggregate).
- [ ] **10.5** `doc/spec/features/feature-result-contract.md`: **explicitly no error-row change** (DEC-5) — verify and record that no reconciliation is needed; `error-table-sync` stays green.
- [ ] **10.6** `doc/overview/glossary.md`: entries for privacy-literal guard, generic rule, hashed literal entry, `private-literal`/`cloud-term`, normalized literal, candidate window, content-free fingerprint, content policy, `content-policy-violation`, vacuous class, working-tree scan (existing one-line table style, linked to the feature doc). Cross-reference sweep: every touched link resolves.

**Acceptance Criteria**:

- Must: every touch point reconciled or explicitly recorded unchanged; `error-table-sync` green; no cross-reference drift; `bash scripts/.tests/test-doc-distribution.sh` green if any guide/template changed.

**Affected code areas**: none. **System docs to update**: all paths above.

**Tests**: `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/forbidden-literals.ts`; `pnpm check`.

**Completion signal**: `docs(GH-184): reconcile system spec and glossary with delivered privacy guard and envelope policy` (@doc-syncer; PM-scheduled)

---

### Phase 11: Finalize and release (lifecycle phases 9–11 — quality_gates, dod_check, pr_creation; PM-scheduled)

**Goal**: A fully gated, versioned, evidenced open-PR handoff; publishing, merge, and owner acceptance remain outside this change.

**Tasks**:

- [ ] **11.1** Version intent recorded (Phase 7 changeset; PD-9): confirm `.changeset/gh-184-privacy-guards-minor.md` is the only release-metadata addition; nothing publishes in this change; the owner may amend at PR review.
- [ ] **11.2** Final gate battery on the **pushed HEAD** (never an earlier SHA): `pnpm install --frozen-lockfile` → `pnpm build` → focused suites → `bun test` → `pnpm check` → `pnpm check:privacy-literals` → boundary/ambient/literal/topology/bindingness/supply-chain/script-surface/changesets-group/license-audit checks → `git diff --check` → `git status --porcelain` clean; record durations and the NFR-5 reference-runner numbers from the CI run.
- [ ] **11.3** DoD check (PM): all 22 ACs have passing traceable evidence in the test-plan execution log and the evidence artifact; all plan tasks complete or explicitly not-required.
- [ ] **11.4** Hand off to `@pr-manager` (lifecycle phase 11): PR targets `main-tools` from `feat/GH-184/privacy-no-cloud-guards`, assigned to the owner, description carrying the baseline suppression inventory, the TC-POLICY-005 reading pin, the owner-facing notes (registry population via `--author` out-of-band; TDR-0005 acceptance pending), and the pushed-HEAD job results; **STOP at the open unmerged PR** — no merge, no owner-acceptance claim.

**Acceptance Criteria**:

- Must: the change-level DoD (below) satisfied with current passing evidence on the pushed HEAD; all required CI jobs green; rollback coherent; no protected path touched.

**Affected code areas**: none unless a gate reopens Phase 9. **System docs to update**: final reconciliation verified against Phase 10.

**Tests**: the full Phase 11.2 battery exactly as consolidated in the evidence artifact.

**Completion signal**: `docs(GH-184): finalize evidence and PR handoff for privacy and no-cloud guards`

---

## Execution Notes for `@coder` (this runtime)

- **Inline committer protocol**: `@coder` cannot dispatch subagents — one Conventional Commit per phase executed inline (message = the phase's completion signal; body lines ≤ 100 chars); explicit staging lists (exactly the phase's Files-and-modules entries); never stage `.ai/local/`, `tmp/`, or untracked scratch; `pnpm check` (plus the phase's focused commands) run and captured before each commit; a red gate blocks the commit — stop at the last green task boundary and report.
- **Fixture hygiene (PD-10)**: committed fixtures under `tests/fixtures/**` are read-only; every other tree self-materializes under `mkdtemp` siblings in the OS temp directory and is removed in teardown; the live tree is read-only to every test; the spawned-process set is exactly test-plan §4.1's license.
- **Content discipline**: no raw private literal, hosted-product term, real credential, salt, or key is ever typed into a fixture, test, doc, commit message, or log; violation output is never pasted into artifacts beyond id/file/line/fingerprint.
- **Evidence honesty**: record only executed evidence with command + HEAD; unrun results are never recorded as passing (test plan §7).

## Test Scenarios

Traceability — all 34 TCs mapped; "primary phase" = where the TC is implemented and first green; parenthesized halves land earlier by design (multi-phase TCs follow the GH-174/GH-179 precedent). TC details, preconditions, and expected outcomes are authoritative in test-plan §5.2.

| TC ID | Scenario (abbreviated) | AC / NFR | Primary phase(s) | Target layer / file |
|-------|------------------------|----------|------------------|---------------------|
| TC-PRIVACY-001 | Seven generic rule classes fire on planted positives | AC-F1-1 | 1 (definition set), 4 (suite) | `tests/checks/privacy-literals.test.ts` + `tests/fixtures/privacy-literals/rules.ts` |
| TC-PRIVACY-002 | Near-miss negatives and the false-positive corpus | AC-F1-2, NFR-2 | 2 (baseline), 4 (suite) | same + `corpus/**` |
| TC-PRIVACY-003 | Placeholder suppression narrow and non-vacuous | AC-F1-2 | 4 | same + `corpus/suppression/**` |
| TC-PRIVACY-004 | Hashed `private-literal` entry detects and clears | AC-F2-1 | 4 | same + `activation.ts` |
| TC-PRIVACY-005 | Authoring-produced entry is data-only, no rebuild | AC-F2-2 | 3 (mode), 4 (suite) | same |
| TC-PRIVACY-006 | Normalization and case/whitespace variants | AC-F2-3 | 4 | same |
| TC-PRIVACY-007 | Window boundaries and distinct-length matrix | AC-F2-3 | 4 | same |
| TC-PRIVACY-008 | Production `cloud-term` empty and reported vacuous | AC-F3-1 | 2 (live report), 4 (suite) | `privacy-literals.test.ts`, `privacy-reporting.test.ts` |
| TC-PRIVACY-009 | Synthetic `cloud-term` activation and removal | AC-F3-2 | 4 | `privacy-literals.test.ts` + `activation.ts` |
| TC-PRIVACY-010 | Registry validation: schema/scope/rules/classes | AC-F4-1, AC-F4-3 | 2 (impl), 4 (RV matrix) | `privacy-registry.test.ts` + `registry.ts` |
| TC-PRIVACY-011 | Registry validation: entries/duplicates/digests/reasons | AC-F4-1 | 2 (impl), 4 (matrix) | same |
| TC-PRIVACY-012 | Registry validation: allowlist/exclusions exactness | AC-F4-1 | 2 (impl), 4 (matrix) | `privacy-registry.test.ts`, `privacy-literals.test.ts` |
| TC-PRIVACY-013 | Registry caps and bounds (NFR-9) | AC-F4-3 | 2 (impl), 4 (matrix) | `privacy-registry.test.ts` |
| TC-PRIVACY-014 | Scan boundary: history/untracked/ignored/binary/exclusions | AC-F4-2 | 2 (impl), 4 (suite) | `privacy-scope.test.ts` + `fixture-repo.ts` |
| TC-PRIVACY-015 | Determinism, read-only, no-network | AC-F4-4 | 2 (behaviour), 4 (suite) | `privacy-reporting.test.ts` |
| TC-PRIVACY-016 | No-echo reporting in both modes | AC-F5-1 | 2 (impl), 4 (suite) | `privacy-reporting.test.ts` |
| TC-PRIVACY-017 | Fingerprint identifier-only, short, stable | AC-F5-1 | 4 | `privacy-reporting.test.ts` |
| TC-PRIVACY-018 | Authoring: stdin-only record, no echo, no writes | AC-F5-2 | 3 (mode), 4 (suite) | `privacy-authoring.test.ts` |
| TC-PRIVACY-019 | Authoring: CI refusal, no argv/env channel | AC-F5-2 | 3 (mode), 4 (suite) | `privacy-authoring.test.ts` |
| TC-PRIVACY-020 | Live-tree green and non-vacuous scope reporting | AC-F3-1, AC-F7-2 | 2 (baseline), 4 (suite) | `privacy-literals.test.ts` |
| TC-PRIVACY-021 | Scan/emitter performance and linearity budgets | AC-F4-2, NFR-5 | 4 (scan half), 6 (emitter half) | `privacy-performance.test.ts` + `performance.ts` |
| TC-POLICY-001 | Guarded payload denied in every field and carrier | AC-F6-1 | 6 | `tests/behaviour/envelope-content-policy.test.ts` + `envelopes.ts` |
| TC-POLICY-002 | Clean envelopes serialize; policy required | AC-F6-2 | 6 | same + `tests/types/envelope-policy.type-test.ts` + `envelope-contract.test.ts` |
| TC-POLICY-003 | Validation order and totality at the codec | AC-F6-1, AC-F6-2 | 6 | `envelope-content-policy.test.ts` |
| TC-POLICY-004 | Failure shape and DM-6 compatibility | AC-F6-1, AC-F6-2 | 6 | same + `envelope-contract.test.ts` |
| TC-POLICY-005 | Codec purity, single serialization point, inventory gates | AC-F6-3 | 1 (shared-module half), 6 (codec half) | `privacy-imports.test.ts`, `envelope-contract.test.ts`, `content-inventory.test.ts` |
| TC-POLICY-006 | Shared-rule parity between scan and emitter | AC-F6-4 | 1 (definitions), 6 (parity suite) | `envelope-content-policy.test.ts`, `privacy-literals.test.ts` |
| TC-POLICY-007 | Human content preserved and not scanned | AC-F6-5 | 6 | `envelope-content-policy.test.ts`, `envelope-write-path.test.ts` |
| TC-POLICY-008 | Hashed-entry matching at the emitter, injected hash/entries | AC-F6-1 | 6 | `envelope-content-policy.test.ts` |
| TC-WIRE-001 | Binding `ts-invariants` invocation, preserved checks | AC-F7-1 | 5 | `privacy-ci-wiring.test.ts` + the five validators |
| TC-WIRE-002 | Local command offline, build-free, count-reporting | AC-F7-2 | 2 (script), 5 (suite) | `privacy-ci-wiring.test.ts` + `package.json` |
| TC-WIRE-003 | New suites under the binding test job and fail it | AC-F7-3 | 4 (suites), 5 (proof) | `privacy-ci-wiring.test.ts`, `bunfig.toml`, `package.json` |
| TC-RELEASE-001 | Exactly one new minor changeset × five packages | AC-F8-1 | 7 | `privacy-release.test.ts` + `.changeset/*` |
| TC-RELEASE-002 | No version hand-edits, unchanged lockfile, no new deps | AC-F8-1 | 7 | `privacy-release.test.ts` + manifests/lockfile |

No TC is orphaned; no task exists without a TC or spec anchor; phases 8–11 are gate phases that introduce no new TCs.

## Definition of Done

### Per-phase checklist

| Phase | Done means |
|-------|------------|
| 1 | Shared module + registry committed; inventory/allowances registered; structure/boundary gates green; commit `feat(GH-184): add pure shared privacy rule module and hashed-literal registry` |
| 2 | Guard validates fail-closed, scans the working tree, reports content-free, **green on the clean tree** with suppressions enumerated; root script added; commit `feat(GH-184): add privacy-literals check with fail-closed registry validation and no-echo working-tree scan` |
| 3 | Authoring mode refuses CI, reads stdin only, never echoes, writes nothing; commit `feat(GH-184): add stdin-only no-echo authoring mode with CI refusal to privacy guard` |
| 4 | TC-PRIVACY-001..021 green incl. every mutant control and the 30-cell matrix; `bun test` discovers all suites; commit `test(GH-184): add privacy guard mutation, registry matrix, scope, reporting, authoring, and performance suites` |
| 5 | Guard invoked by name in `ts-invariants`; five preserved validators + `ci-checks.test.ts` green unweakened; local command proven; commit `ci(GH-184): wire privacy-literals into ts-invariants with local command and preserved gates` |
| 6 | Policy required at the codec with the new failure kind; all call sites updated; TC-POLICY-001..008 green; purity gates green; guard still green; commit `feat(GH-184): require injected pure content policy at envelope serialization with content-policy-violation failure` |
| 7 | One new changeset × five packages; release suites green; evidence artifact complete; working-HEAD battery green; commit `chore(GH-184): add five-package minor changeset with release-integrity suites and delivery evidence` |
| 8–11 | Review verdict recorded; findings closed or not-required; doc-sync touch points reconciled; pushed-HEAD battery + open unmerged PR targeting `main-tools` (PM-scheduled) |

### Change-level DoD (open-PR gate)

- All 22 ACs have passing traceable TC evidence (commands + HEAD) in the test-plan execution log and `chg-GH-184-evidence.md`.
- `pnpm check` green on the pushed HEAD; `pnpm check:privacy-literals` green offline and build-free; boundaries, ambient, secret-read, forbidden-literals, topology, bindingness, supply-chain, script-surface, changesets-group, license-audit green — **no gate weakened**.
- The guard fires on every mutation case, stays green on the clean tree, reports `cloud-term` as explicitly vacuous, and no output channel contains planted content (echo mutants caught).
- Every serialization call site passes a policy; codec purity gates green; the failure union is exactly the three kinds.
- Exactly one new five-package minor changeset; every pre-existing changeset byte-identical; no version hand-edit; lockfile unchanged; zero new dependencies.
- No protected path touched; nothing from `.ai/local/` or `tmp/` staged; an open unmerged PR targets `main-tools` — no merge or owner-acceptance claimed.

## Artifacts and Links

| Artifact | Location | Role / handling |
|----------|----------|-----------------|
| Change specification (v1.1) | [chg-GH-184-spec.md](./chg-GH-184-spec.md) | Requirements source: F-1..F-8, 22 ACs, NFR-1..NFR-9, §18 rollout order |
| Test plan (v1.1, 34 TCs) | [chg-GH-184-test-plan.md](./chg-GH-184-test-plan.md) | TC ids, §4.1–§4.4 binding contracts, RV-01..30, §7 battery |
| This plan | `./chg-GH-184-plan.md` | The only file written by this authoring pass |
| PM notes | `./chg-GH-184-pm-notes.yaml` | Delivery ledger (not edited by this pass) |
| Decision records | [TDR-0005](../../../decisions/TDR-0005-privacy-and-no-cloud-guard-mechanics.md), [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Binding mechanics; tier/boundary matrix |
| Shared rule module | `packages/adapters/src/io/privacy-rules.ts` | New (PD-1); the single rule-definition set |
| Policy builder | `packages/adapters/src/io/envelope-content-policy.ts` | New (PD-1, Phase 6); pure, injected hash + entries |
| Guard check + registry | `scripts/checks/privacy-literals.ts`, `scripts/checks/privacy-literals.registry.json` | New (PD-2..PD-5); registry is data-only extension surface |
| Envelope contract + codec | `packages/core/src/contracts/envelope.ts`, `packages/adapters/src/io/envelope-codec.ts` | Updated (PD-8, Phase 6); required policy + failure kind |
| CI wiring | `.github/workflows/ci.yml` (one additive `ts-invariants` line), `package.json` (`check:privacy-literals`) | PD-6; aggregate byte-unchanged, no new job |
| Guard suites | `tests/checks/privacy-*.test.ts`, `tests/behaviour/envelope-content-policy.test.ts`, `tests/structure/privacy-imports.test.ts`, `tests/types/envelope-policy.type-test.ts`, `tests/fixtures/privacy-literals/**` | New (Phases 1, 4, 5, 6) |
| Release intent | `.changeset/gh-184-privacy-guards-minor.md` | New (PD-9, Phase 7); fixed group, minor |
| Delivery evidence | `./chg-GH-184-evidence.md` | New (Phase 7); battery, TC map, suppression inventory, rollback |
| Review records | `./review/review-iter-*.md` | New in Phase 8 if findings are recorded |
| Expected doc-sync touch points | `doc/spec/features/feature-privacy-guard.md` (new), `feature-adapter-ports.md`, `feature-branding-seam.md`, `feature-monorepo-scaffold-toolchain.md`, `doc/overview/glossary.md` | Phase 10 (`@doc-syncer`); `feature-result-contract.md` explicitly unchanged (DEC-5) |

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------------|--------|---------|
| 1.0 | 2026-10-31T07:05:00Z | Implementation Plan Writer | Initial eleven-phase plan from spec v1.1, test plan v1.1, TDR-0005, and the live repo constraints (ci-topology/bindingness/supply-chain/script-surface/boundary-ci-parity, content-inventory, changesets config, the codec and its three call sites, the five pre-existing changesets). PD-1..PD-10 pinned (module location and sharing with layering justification, registry schema and caps-as-code, validation order, scan/reporting mechanics, authoring mode, CI wiring, baseline policy, codec shape, changeset, test discipline); three authoring findings recorded (TC-POLICY-005 import wording, execution-order halves, allowlist enumeration); full 34-TC traceability; rollback; DoD; execution log. 11 phases, 56 tasks, 34 TCs — none orphaned. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-31T06:39:00Z | 2026-10-31T07:05:00Z | none | Read spec v1.1, test plan v1.1, TDR-0005, the GH-179/GH-181 plan precedents, and the live gate files; verified the `ts-invariants` no-build constraint, the `depcruise packages` scope, the adapters `#io/*` alias, the codec's three in-repo call sites, and the five pre-existing changesets. Only this plan file was written; no code, builds, tests, or git operations. Executors record per-phase evidence, commands, HEAD, and the pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
| 1 | Not started | — | — | — | |
| 2 | Not started | — | — | — | |
| 3 | Not started | — | — | — | |
| 4 | Not started | — | — | — | |
| 5 | Not started | — | — | — | |
| 6 | Not started | — | — | — | |
| 7 | Not started | — | — | — | |
| 8 | Not started | — | — | — | PM-scheduled gate |
| 9 | Not started | — | — | — | Conditional; PM-scheduled |
| 10 | Not started | — | — | — | PM-scheduled (@doc-syncer) |
| 11 | Not started | — | — | — | PM-scheduled; STOP at the open unmerged PR |
