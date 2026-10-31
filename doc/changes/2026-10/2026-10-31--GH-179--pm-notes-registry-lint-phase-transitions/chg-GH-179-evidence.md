# GH-179 — delivery evidence

> **Finalization status: AUTHORED, PHASE 12.4 BATTERY PENDING.** Tasks 12.1–12.3
> are complete: the minor changeset, this evidence artifact, and the
> owner-facing handoff notes are committed and pushed with the finalize
> commit. The ordered Phase 12.4 battery on the **pushed HEAD** (install →
> build → focused suites → `bun test` → `pnpm check` → boundary/ambient/literal/
> sync checks → `git diff --check`) has **not been run by this authoring task**
> and is **not recorded as passing** here. The last measured aggregate evidence
> is Phase 8 at `1a482c0` (**913 pass / 0 fail**) and the independent
> `@reviewer` iteration 1 re-measurement on the docs-only tree at `3d0d3cf`
> (913/913, error-table-sync 26/26, doc-distribution clean). No PR has been
> created and no merge has been performed.

Authoritative artifacts: [spec](./chg-GH-179-spec.md) v1.2 (AC-L1..L6,
C-1..C-6, NFR-1..5, pinned LITE set, corpus boundary), [test plan](./chg-GH-179-test-plan.md)
v1.0 (25 TCs), [plan](./chg-GH-179-plan.md) v1.0 (12 phases, PIN-1..PIN-8,
D1..D11), DoR verdict [readiness iteration 1 — READY](./readiness-review/readiness-iter-1.md)
(3 nits, all dispositioned). Review artifacts: [review iteration 1](./review/review-iter-1.md)
(PASS — 0 blocker / 0 major / 3 minor / 4 info), machine state
[`code-review/review-iter-1.yaml`](./code-review/review-iter-1.yaml).

Branch: `feat/GH-179/pm-notes-registry-lint-phase-transitions`, based on
`main-tools` @ `f6c8d18`. Every phase 1–8 was independently green at its commit
boundary; the review-iteration and doc-sync commits are documentation-only.

## Phase commits

| Phase | Commit | Message |
|-------|--------|---------|
| 1 | `9ede8b9` | `feat(GH-179): add pm-notes and registry vocabulary with synchronized lint error rows` |
| 2 | `122adf0` | `feat(GH-179): add pure pm-notes conformance rules with rejection-class fixtures` |
| 3 | `e77c0bc` | `feat(GH-179): add lint command with target resolution, envelope, and determinism proofs` |
| 4 | `1f13f45` | `test(GH-179): pin variant-era corpus acceptance fixture with exclusion manifest guards` |
| 5 | `ad3efde` | `feat(GH-179): add delivery registry over the state port with derived phase projection` |
| 5 (evidence correction) | `327b5b8` | `docs(GH-179): correct phase 5 evidence count and record registry payload fold decision` |
| 6 | `ebeadb3` | `feat(GH-179): add phase command write path with idempotent transitions and entry creation` |
| 7 | `91b1f43` | `feat(GH-179): complete phase matrix with advisories, ordering proofs, and write-path lint` |
| 8 | `1a482c0` | `test(GH-179): complete boundary, packed Node/Bun probe, and aggregate gates with feature doc` |
| delivery record | `98ce450` | `chore(GH-179): record delivery completion for plan phases 1-8` |
| 11 (doc sync) | `3d0d3cf` | `docs(GH-179): reconcile system docs with delivered lint and phase surface` |
| 9 (review + F-1/F-2) | `c70eca1` | `docs(GH-179): review PASS, fold F-1/F-2 bookkeeping` |
| 10 | — | Not needed (review PASS; no blocker/major finding) |
| 12 (this task) | finalize commit (`chore(GH-179): add changeset and delivery evidence`) | Changeset, this evidence file, and the plan 12.1–12.3 status |

## Phase green criteria (observed)

| Phase | Commands | Result |
|-------|----------|--------|
| 1 | focused contract/error-table/sync suites; `bun run scripts/checks/error-table-sync.ts`; `pnpm check` | focused **83/83**; sync `entries=26 documented=26`; `pnpm check` exit 0 (**739 tests**); `classifyDomainKind` needed no change |
| 2 | focused lint-rule/rejection suites; boundary; `pnpm check` | focused **54/54**; `pnpm check` exit 0 (**793 tests**), boundaries green; rule order parse → keys → types → variant → phases; opaque extras never inspected |
| 3 | focused lint command suites; `pnpm check` | focused **99/99**; `pnpm check` exit 0 (**820 tests**), boundaries green; TC-LINT-004 torn-registry asserts exit 2 |
| 4 | `pm-notes-corpus.test.ts`; `pnpm check` | corpus **15/15** (membership, live drift, manifest and schema-mutation controls); boundary members GH-170/172/173/174/181/179; GH-171 excluded only by manifest; `pnpm check` exit 0 (**835 tests**) |
| 5 | `phase-registry.test.ts` + `registry-imports.test.ts`; `pnpm check` | **14/14** + **4/4**; `pnpm check` exit 0 (**853 tests**), boundaries green; two documented additive deviations (projection `document` intent record; `transitions[]` history in the payload) |
| 6 | `phase-transitions` + `phase-idempotency` + corpus; `pnpm check` | **8/8**, **5/5**, corpus **17/17** (incl. both write-path controls); `pnpm check` exit 0 (**868 tests**); two documented additive additions (`readPmNotesText`/`stagePmNotesPhaseEntry`; `state-scope` consumer allowlist superseding GH-174's "no consumer" premise, seeded control live) |
| 7 | focused phase suites; `pnpm check` | **59/59**; `pnpm check` exit 0 (**900 tests**), boundaries green; row 6 advisory, grammar-before-state recording seam + wrongly-ordered control, eight-class write-path lint matrix, phase envelope/exit matrix |
| 8 | boundary/ambient/literal/exit/workspace/sync checks; packed probe; `pnpm check` | `pnpm check` exit 0 (**913 tests**); depcruise clean; ambient-globals, forbidden-literals, exit-code-literals, workspace-entrypoints, error-table-sync (26/26) green; packed Node/Bun probe green; feature doc registered; GH-179's own pm-notes in the passing corpus |

## Final gate consolidation (measured at `1a482c0`; re-measured by review at `3d0d3cf`)

| Gate | Result |
|------|--------|
| Focused phase/lint suites | 59/59 (Phase 7 boundary) plus `phase-transitions` + `pm-notes-lint` **40/40** re-run live by `@reviewer` |
| `pnpm check` (aggregate, docs-only commits after `1a482c0`) | **913 pass / 0 fail**, 5461 `expect()` calls, **87 files**; lint, format, typecheck (six packages), tests, boundaries, exports-parity all green |
| `bun run scripts/checks/error-table-sync.ts` | exit 0; **`entries=26 documented=26 S1=36 S3=14 corpus=13`** — both directions agree; the five lint rows exist exactly once in `doc/spec/features/feature-result-contract.md` |
| `pnpm run check:boundaries` | exit 0; `depcruise` 78 modules, no violations |
| `bun run scripts/checks/ambient-globals.ts` | exit 0; 22 neutral-set files clean |
| `bun run scripts/checks/forbidden-literals.ts` | exit 0; 0 violations; `feature-pm-notes-lint-and-phase-transitions.md` registered |
| `bun run scripts/checks/exit-code-literals.ts` | exit 0 |
| `bun run scripts/checks/workspace-entrypoints.ts` | exit 0 |
| `bun run scripts/checks/secret-read-boundary.ts` | exit 0; 63 production files |
| `bun run scripts/checks/exports-parity.ts` | exit 0; 5/5 publishables |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0; **no drift** — 80 in-scope docs; the new feature doc is `doc/spec/**`, outside the marker guard's scope |
| `bun run scripts/checks/changesets-group.ts` | exit 0; one fixed group of five, `testkit` excluded; the new `pm-notes-lint-minor.md` changeset is consistent (re-checked in Phase 12.4) |
| Protected-path proof (`.opencode/**`, `.ados-claude/**`, `.ai/**`, `scripts/*.sh`, `tools/**`, `.github/**`) | clean — `git diff --name-only f6c8d18..HEAD` touches only `doc/`, `packages/`, `tests/`, `scripts/checks/` |
| `git status --porcelain` | clean of test writes — every fixture root self-materializes under the OS tmpdir and is removed in teardown |

**Not yet run (Phase 12.4, open):** the ordered pushed-HEAD battery
`pnpm install --frozen-lockfile` → `pnpm build` → focused suites →
`bun test` → `pnpm check` → boundary/ambient/literal/sync checks →
`git diff --check`. These rows must be filled from the pushed HEAD before the
PR handoff; no unrun result is recorded as passing.

## TC coverage map (25/25 implemented and green)

| TC | Executing suite | Command | AC / NFR |
|----|-----------------|---------|----------|
| TC-LINT-001 | `tests/behaviour/pm-notes-lint-rejections.test.ts` + `tests/fixtures/pm-notes/malformed/**` | `bun test tests/behaviour/pm-notes-lint-rejections.test.ts` | AC-L1 |
| TC-LINT-002 | `tests/behaviour/pm-notes-lint-rejections.test.ts` | same | AC-L1 |
| TC-LINT-003 | `tests/behaviour/pm-notes-lint-rejections.test.ts` + `tests/fixtures/pm-notes/variant/**` | same | AC-L1 |
| TC-LINT-004 | `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/behaviour/pm-notes-lint.test.ts` | AC-L1, AC-L5 |
| TC-LINT-005 | `tests/behaviour/pm-notes-lint.test.ts` + variant fixtures | same | AC-L1, AC-L4 |
| TC-LINT-006 | `tests/behaviour/pm-notes-lint.test.ts`, `tests/structure/pm-notes-contract.test.ts` | both files | AC-L4, AC-L6 |
| TC-LINT-007 | `tests/behaviour/pm-notes-corpus.test.ts` | `bun test tests/behaviour/pm-notes-corpus.test.ts` | AC-L6 |
| TC-LINT-008 | `tests/behaviour/pm-notes-corpus.test.ts` + `tests/fixtures/pm-notes/corpus-exclusions.json` | same | AC-L6 |
| TC-LINT-009 | `tests/behaviour/pm-notes-lint-determinism.test.ts` | `bun test tests/behaviour/pm-notes-lint-determinism.test.ts` | NFR-3 |
| TC-LINT-010 | `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/behaviour/pm-notes-lint.test.ts` | AC-L1, NFR-2 |
| TC-PHASE-001 | `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts` | both files | AC-L2 |
| TC-PHASE-002 | `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts` | both files | AC-L2 |
| TC-PHASE-003 | `tests/behaviour/phase-transitions.test.ts` | same | AC-L2 |
| TC-PHASE-004 | `tests/behaviour/phase-transitions.test.ts` | same | AC-L2 |
| TC-PHASE-005 | `tests/behaviour/phase-rejections.test.ts` | `bun test tests/behaviour/phase-rejections.test.ts` | AC-L2, AC-L3 |
| TC-PHASE-006 | `tests/behaviour/phase-write-path-lint.test.ts` | `bun test tests/behaviour/phase-write-path-lint.test.ts` | AC-L1 |
| TC-PHASE-007 | `tests/behaviour/phase-registry.test.ts` + `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/phase-registry.test.ts` | AC-L5 |
| TC-PHASE-008 | `tests/behaviour/phase-envelope.test.ts` | `bun test tests/behaviour/phase-envelope.test.ts` | NFR-2 |
| TC-PHASE-009 | `tests/behaviour/phase-registry.test.ts`, `tests/behaviour/phase-transitions.test.ts` | both files | AC-L2, AC-L5 |
| TC-SYNC-007 | `tests/structure/error-table.test.ts` + write-path half in `tests/behaviour/phase-envelope.test.ts` | both files | NFR-5 |
| TC-SYNC-008 | `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | NFR-5 |
| TC-SYNC-009 | `tests/behaviour/error-classification.test.ts` | `bun test tests/behaviour/error-classification.test.ts` | NFR-5 |
| TC-BOUND-001 | `tests/structure/pm-notes-imports.test.ts`, `tests/structure/registry-imports.test.ts`, `tests/structure/pm-notes-contract.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals}.ts` | `bun test tests/structure tests/boundaries`; the three checks | NFR-1 |
| TC-BOUND-002 | `tests/structure/cli-edge-seam.test.ts`, `tests/structure/pm-notes-imports.test.ts` | `bun test tests/structure` | NFR-1 |
| TC-BOUND-003 | `tests/checks/packed-state.test.ts` (extended GH-174 probe; `TC-STATE-021` lineage) | `pnpm build` then `bun test tests/checks/packed-state.test.ts` | NFR-1 |

Execution order per test plan §7: structure/vocabulary → lint rejection classes →
corpus/boundary → determinism/envelope → phase matrix → write-path lint and
registry safety → phase envelope → error-table sync → packed probe + aggregate.

## Corpus boundary evidence (AC-L6, NFR-4)

- Corpus members enumerated at run time from `doc/changes/<month >= 2026-10>/`
  and linted with the effective-variant default: **GH-170, GH-172, GH-173,
  GH-174, GH-181, GH-179 — all 6 pass** (including this change's own pm-notes,
  A-T8).
- **35** committed pm-notes documents exist; **21** legacy documents sit
  outside the corpus: **14 predate `dor_check`**, **20 predate `delivery_mode`**,
  and **GH-171 is unparseable** (excluded solely by the manifest).
- `tests/fixtures/pm-notes/corpus-exclusions.json` contains exactly one path
  (`doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml`).
  The guard asserts the entry exists, is genuinely unparseable, and that a
  second entry fails — the manifest cannot grow silently (RSK-T5).

## Review findings and dispositions

Review iteration 1 = **PASS** (0 blocker / 0 major / 3 minor / 4 info);
Dimension A (spec/plan compliance) and Dimension B (code quality) both PASS.
No remediation phase (Phase 10) was needed.

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| F-1 | minor | Phase 11 record claimed "residual gaps: NONE" while tasks 11.5/11.6 were unexecuted | PM scope decision: planning registries are static build-order maps without delivery-status semantics; tasks 11.5/11.6 RESOLVED UNCHANGED; plan row 11 corrected — carried as owner handoff Note 4 |
| F-2 | minor | Plan metadata timestamps contradicted the delivery sequence (DoR nit N1) | Folded in `c70eca1` (timestamps + revision-log entry) |
| F-3 | minor | Landing sequence append → document-write → projection has no compensation; stale pm-notes if the document write fails after the ledger append | Accepted design behavior: ledger is authoritative, projection rebuildable; recovery is reopen + complete — carried as owner handoff Note 3 |
| F-4 | info | Unknown variant gates entry-level keys/types, so a cross-defect document reports `lint.variant.unknown` | Defensible per C-6 (one code per class); no action |
| F-5 | info | Each `phase.transition` payload embeds full verified history (quadratic bytes over a change's lifetime) | Documented Phase 5 deviation; bounded by lifecycle size; no action |
| F-6 | info | Corpus fixture copies the whole `doc/changes` tree per mutation control | Hermetic and correct; optional future optimization; no action |
| F-7 | info | A parser read error maps to `lint.notes.malformed` | Contained and classified; within the C-6 five-code budget; no action |

## Rollback

The change is fully additive. Reverting the single delivery branch (or the
eventual PR) removes, together: the `pm-notes`/`registry` contracts rows and
vocabulary, the pure domain lint rules, the `lint` domain kind with its five
error-table rows, the documented rows in
`doc/spec/features/feature-result-contract.md`, the delivery registry module,
the `lint` and `phase` commands and their edge composition, the parser
document-edit API, all tests and fixtures (including the corpus manifest), the
feature doc and its forbidden-literals registry row, the changeset, and the
doc/spec/glossary/lifecycle edits. There is no migration and no rewrite of
persisted operator data: `phase.transition` and `document` intent records
already in a state directory simply become unread by the reverted code.

**Never roll back one side of the error-table sync.** The machine `ERROR_TABLE`
rows in `packages/core/src/contracts/error-table.ts` and the documented rows in
`doc/spec/features/feature-result-contract.md` must move together, or
`error-table-sync` fails closed in both directions.

After any rollback, re-run the repository baseline: `pnpm install
--frozen-lockfile`, `pnpm build`, `bun test`, `pnpm check`,
`bash scripts/.tests/test-doc-distribution.sh`, and
`bun run scripts/checks/error-table-sync.ts`. No bash-stack, `.opencode/**`,
`.ados-claude/**`, `scripts/*.sh`, `tools/**`, or CI-topology file is touched by
this change.

## Owner-facing PR handoff notes

**Note 1 — GH-171 pm-notes is a known-unparseable historical artifact.**
`doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml`
does not parse and is excluded from the corpus fixture **solely** by
`tests/fixtures/pm-notes/corpus-exclusions.json`. The exclusion is guarded:
exactly one entry, the file must exist and be genuinely unparseable, and adding
a second entry fails the suite. Its repair is **owner follow-up outside this
change** — GH-179 neither repairs nor rewrites it (AC-L6).

**Note 2 — the pinned LITE set and the `minor` impact are owner-amendable.**
The LITE required-phase set (`clarify_scope`, `specification`, `delivery`,
`quality_gates`, `dod_check`, `pr_creation`) is a **reversible schema
constant** the owner may amend at PR review (spec C-2), as may the `minor`
version impact (A-T7). Corpus boundary evidence backing the choice: all **6**
variant-era corpus documents pass; **21 of 35** committed documents sit outside
the corpus (**14 predate `dor_check`**, **20 predate `delivery_mode`**), and
GH-171 is unparseable — so the corpus is the variant era, not the full history.

**Note 3 — review advisory F-3 (accepted design behavior).** The phase landing
sequence is append → document write → projection write with no compensation.
If the pm-notes document write fails after the ledger append, the command
reports `fallback.internal` and the pm-notes entry stays stale while the
authoritative ledger records the landing; a re-run of the same `complete` is a
no-op and does not converge the document. Recovery is **reopen + complete**
(landing two extra records). The ledger remains authoritative and the
projection is rebuildable; this consistency window is recorded as **accepted
design behavior for PR review**, not a defect.

**Note 4 — scope decision: planning registries intentionally untouched.**
`doc/planning/oss-tooling/cli-command-registry.md` (Delivery column) and the
backlog/ranking registers were not updated (review F-1; plan tasks 11.5/11.6
RESOLVED UNCHANGED). They are static build-order maps without delivery-status
semantics, and prior M0 deliveries left them untouched. The owner may introduce
a status convention for them if desired; this change adds no speculative
consumer documentation.

## Open items

1. **Phase 12.4 pushed-HEAD battery.** Run the ordered battery on the pushed
   HEAD and record the results here before PR handoff; then hand off to
   `@pr-manager` (PR targets `main-tools`, assigned to the owner). STOP at the
   open unmerged PR — no merge, no owner-acceptance claim.
2. **Owner decisions at PR review:** LITE required-phase set and `minor` version
   impact (Note 2), F-3 accepted behavior (Note 3), planning-registry convention
   (Note 4), and GH-171 repair as owner follow-up (Note 1).
