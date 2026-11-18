# Code Review — GH-335 — Iteration 4 (post-sync re-review)

**Work item:** GH-335 · **Branch:** `feat/GH-335/opencode-harness-telemetry` · **PR:** #357 → `main-tools`
**Mode:** local · **Reviewed head:** `c4f519dc` (merge of `origin/main-tools` `ec1a2626` into reviewed head `0d729713`)
**Date:** 2026-11-18 · **Previous verdict:** iteration 3 `PASS`

---

## Verdict

**Status = FAIL.** Two blocking findings, both rooted in one fact the sync could not have known when it
started: **`main-tools` advanced three minutes after the sync merge and already owns the exact four
decision-record ids this change renumbered to.**

- **F-1 (blocking).** `origin/main-tools` head `1e7ecf07` (GH-339, PR #356, committed 2026-11-18
  19:50:33 +0100) contains `TDR-0040-cross-adapter-parity-matrix-declared-difference-register.md`,
  `TDR-0041-tracker-error-taxonomy-delivered-identities.md`,
  `TDR-0042-simulated-stateful-tracker-double-declared-effects.md`,
  `TDR-0043-registration-only-adapter-extensibility-proof.md`. The sync merge (`c4f519dc`, 19:47:37
  +0100) renumbered this change's four harness records **to those same ids**. The merge's renumber is
  internally complete and correct against the base it actually merged (`ec1a2626`), but **against the
  branch the PR targets the ids are already taken**. Pushing `c4f519dc` and re-syncing will produce
  two different records per id unless the four records move again — to **TDR-0040…0043**
  (seat/spawn, envelope detail, integration mode, adapter contract; 0040–0043 are free on
  `main-tools`, whose highest id today is 0039).
- **F-2 (blocking).** The reviewed head is **not mergeable with the current base**. `git merge-tree
  HEAD origin/main-tools` reports seven content conflicts (`doc/00-index.md`,
  `doc/decisions/00-index.md`, `doc/overview/glossary.md`,
  `doc/spec/features/feature-adapter-conformance.md`, `feature-adapter-ports.md`,
  `feature-result-contract.md`, `doc/spec/nonfunctional.md`) plus auto-merged-but-unverified
  `packages/testkit/src/index.ts`, `tests/structure/{conformance-coverage.test.ts,
  content-inventory.test.ts, inventory.json}`. PR #357's head is still `0d729713` (the sync is
  unpushed), so GitHub will keep reporting it `CONFLICTING`.

Nothing is wrong with **how** the eight conflicts were resolved, and no reviewed property of the
change regressed. The change needs one more sync onto `1e7ecf07` **with the four records renumbered
to 0040–0043 in the same pass**, then a gate re-run. That is mechanical, but it is not done, and it
cannot be merged until it is.

---

## Scope and method

Re-review of the sync merge only, against iteration 3's PASS (`review/review-iter-3.yaml`). Method:
diff the merge against **both parents** for every conflicted file and every file both branches
touched; audit every `TDR-` citation direction in the tree; verify the renumber by file rename,
front matter, index/register, contracts/comments and harness pages; verify the two merged behaviours in
`production.ts`; prove the harness sources are unchanged since the reviewed head; run the declared
gates.

## 1. The eight conflicts — resolved as genuine unions, nothing lost

For each conflicted file I diffed `c4f519dc` against `0d729713` (only GH-338 content may appear as
additions) and against `ec1a2626` (only GH-335 content may appear). No file was deleted; the four
decision files are renames `R099/R099/R098/R095` — id text only.

| File | GH-338 side preserved | GH-335 side preserved | Verdict |
|---|---|---|---|
| `doc/00-index.md` | new *Adapter Reference Behavior* row; *Merge and Verify Deploy* row wording | the six harness/adapter rows GH-335 rewrote (telemetry-v2, closeout, harness-adapters, dispatch-engine, conformance, merge-verify-deploy) | union ✓ |
| `doc/decisions/00-index.md` | rows TDR-0032…0035 with GH-338 filenames/titles | rows TDR-0040…0039, ascending, correct filenames, `Proposed` | union ✓ |
| `doc/overview/glossary.md` | seven new adapter-contract rows (CLI-first transport, transport matrix, probe, transport selection, workflow map, evidence read, provider-side landing); `provider.not-found` read-scope clause; `GH-338` in `related_changes` | *Integration mode* and *Harness seat binding* rows intact | union ✓ |
| `feature-adapter-conformance.md` | fourteen-step registry over nine closed operations (all "eight"/"thirteen" wording gone); cross-transport parity; GH-338 evidence files | harness conformance registry, unchanged six-scenario floor, four additive extension scenarios, refusal map, `TDR-0043` link | union ✓ |
| `feature-adapter-ports.md` | nine operations incl. `merge-delivery-request`; additive extension block; verbatim job timings; four new adapter source rows | harness port family summary | union ✓ |
| `feature-closeout.md` | `transition-work-item` "one state-only issue close", `write-delivery-request` supported, `write-comment` supported, `merge-delivery-request` row, nine-operation counts, `TDR-0035` | `session-compaction` / telemetry-capture text, harness source rows, `TDR-0040` | union ✓ |
| `feature-result-contract.md` | `steer` kind and the main-tools row set (the 149-identity count of the pre-merge page) | 153 identities, thirteen harness rows, four new refusal rows (`harness.version.*`, `harness.mode.unavailable`, `harness.profile.model-unrepresentable`), `detail.harness` member prose, `TDR-0041` | union ✓ |
| `packages/cli/src/production.ts` | GitHub CLI transport selection, probe, degradation notice, `githubTransportSelection`/`githubCliRunner` facts, exported native-transport factory | `dispatchComposition` mount of `createHarnessProfilePort`, memoised `resolveProfileContextFrom`, admission/facts wiring, `PRODUCTION_OPENCODE_ARGS` | both ✓ |

Line-level presence checks on the nine files both branches changed but git auto-merged
(`doc/overview/architecture-overview.md`, `doc/planning/oss-tooling/status.md`,
`milestones/m3/ranking.md`, `doc/spec/nonfunctional.md`, `packages/core/src/contracts/index.ts`,
`tests/fixtures/ports/v1-contract-inventory.json`, `tests/structure/conformance-coverage.test.ts`,
`content-inventory.test.ts`, `inventory.json`) show every added line from each side still present.
`contracts/index.ts` is a clean two-sided union (GH-338 landing types + GH-335 harness types);
`nonfunctional.md` carries both sides' NFR amendments with no duplicate NFR ids.

**No contradiction found between any GH-338 and GH-335 statement.**

## 2. The renumber: internally complete and safe — but pointing at ids that are taken

Mapping applied: seat/spawn 0032→**0036**, envelope 0033→**0037**, integration mode 0034→**0038**,
adapter contract 0035→**0039**.

**Complete (verified):**

- 523 citations of 0036–0039 across **57 files** in this tree, and **zero live GH-335 file** (spec,
  test plan, plan, decision-review, spike evidence, pm-notes, code, contracts, harness pages) cites an
  old id. The only exceptions are the two readiness-history snapshots recorded as F-3.
- The four records' front matter ids match their filenames, their mutual cross-references are
  correct (TDR-0040 → 0037; TDR-0042 → 0036/0037; TDR-0043 → 0036/0037/0038), and the index and
  register rows are correct and ordered.
- **No wrong-direction renumber.** Every surviving 0032–0035 citation in a file this change owns
  genuinely means a GH-338 record: `packages/adapters/src/github/{cli-transport,client,
  thread-discussion,workflow-map}.ts`, `tests/boundaries/fixtures/cases.ts`,
  `tests/checks/engine-first-hermetic.test.ts`, and the GH-338-owned spec pages.
- GH-338's own change folder is untouched: it still cites 0031–0035 exactly as reviewed (no
  accidental renumber in the other direction).

**Not safe (blocking):** `origin/main-tools` already has records 0036–0039 — GH-339's parity matrix,
tracker error taxonomy, simulated stateful double and registration-only extensibility proof — with
**294 citations** across `packages/testkit/src/conformance/**`,
`tests/fixtures/providers/conformance/**`, the conformance/ports/reference-behavior/provider-seeds
pages and GH-339's own change folder. `origin/main-tools` also claims 0036/0037 in
`feature-adapter-conformance.md` and `feature-result-contract.md` — pages this change also edits, so
the second sync will have to union text that is already id-contradictory until the renumber moves.

The collision is exactly the failure the change's own pm-notes rule names ("the record that lands
first on main-tools owns the id"); GH-339 landed first.

## 3. `production.ts` carries both behaviours

- Harness side intact: `createHarnessProfilePort` is still mounted in `dispatchComposition`
  (`production.ts:3028–3034`) with the memoised `resolveProfileContextFrom` context provider, the
  admission (`createHarnessAdmission`) and `harnessFacts` wiring, `PRODUCTION_OPENCODE_ARGS`, and the
  injected reserved-word binding seams. Diffing `production.ts` between `0d729713` and `c4f519dc`
  shows **no deletion of harness logic** — only GH-338 additions and five comment id updates.
- GH-338 side intact: `resolveCompositionTransportSelection`, `CompositionTransportFacts`,
  `githubTransportSelection`/`githubCliRunner` facts, the single rendered degradation notice, and the
  CLI-vs-native transport choice (with the hostname computed once) are all present. Every GH-338-added
  line from the base→`ec1a2626` delta survives.
- Evidence both compose: `harness-profile-composition-mount` (GH-335) and
  `providers/github-cli-transport` + `conformance/github-transport-parity` + `closeout-telemetry-production`
  (GH-338) → **68 pass / 0 fail**.

## 4. No regression on the reviewed properties

Every GH-335-owned source file the merge touched differs from the PASSed head only in comments:
`packages/adapters/src/harness/{opencode,telemetry-opencode}.ts`,
`packages/core/src/{app/dispatch,config/catalog,config/harness,contracts/dispatch,
contracts/harness,contracts/harness-telemetry,contracts/result,domain/harness-mode,
domain/harness-profile-propagation}.ts`, `packages/cli/src/{edge,index,commands/dispatch}.ts`,
`packages/testkit/src/result-conformance.ts`, the five harness behaviour files,
`tests/types/dispatch-envelope-detail.type-test.ts` and `tests/checks/decision-record.test.ts`:
112 changed lines (56 removed / 56 added), **every one of them containing only a `TDR-00xx` id and
no other change**. Therefore DEC-15 (shipped dispatch supplies
no agent, discloses `unresolved-seat`), DEC-17/DEC-18 refusal precedences, the two-member carrier, the
telemetry additivity/bounds, the six-scenario conformance floor and the deny-by-default spawn
environment are unchanged by construction, and the focused suites still pass (39 pass for the five
harness behaviour files + `decision-record`, 59 pass for the three structure inventories).

## 5. Gates — measured on this tree

| Gate | Result |
|---|---|
| `TMPDIR=$PWD/tmp/tmpdir pnpm check` | **EXIT 0** — lint (109 warnings, 0 errors), format:check, typecheck, build, test, boundaries, memory, prompt-conformance, help-guide-coverage, exports-parity all pass |
| `bun test` totals | **10791 pass / 4 skip / 0 fail; 10795 tests across 1356 files** (1550 s) |
| Load-sensitive flake | **Did not reproduce.** Iteration 3's 5 s timeout / subprocess cascade is absent; no isolation re-run was needed |
| `./scripts/lint-commit-range.sh --base ec1a2626` | **PASS** — 45 commits, 0 offending |
| `bash scripts/.tests/test-doc-distribution.sh` | **PASS** — 96 in-scope docs, no install-set drift |
| `delivery-os plan validate GH-335` | `verdict=valid`, `tier=full`, `readyForDevelopment=true` |
| Targeted re-runs | harness behaviour + `decision-record` 39/39; structure inventories 59/59; composition mount + GH-338 transport 68/68 |

`plan diff` could not be executed (`input.value.rejected`, "repository diff for GH-335 could not be
read") — the local `main-tools` ref does not exist. Reported as a tool limitation, not a finding.

**Discrepancy noted:** the pm-notes claim "10791 pass / 4 skip / 0 fail across 1359 files"; the test
counts reconcile exactly, the file count does not (measured 1356 = `find tests -name '*.test.ts'`,
matching bun's own line). Info-level (F-6).

---

## Findings

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-1 | **high (blocking)** | `doc/decisions/` + 57 citing files | The four records were renumbered to TDR-0040…0039, which `origin/main-tools` already assigns to GH-339's four records (`1e7ecf07`, 294 citations). Duplicate ids across the target branch. | Renumber to **TDR-0040** (seat/spawn), **0041** (envelope), **0042** (integration mode), **0043** (adapter contract): filenames, front matter, cross-references, index, register, this change's artifacts and harness pages. Leave GH-338's 0032–0035 and GH-339's 0036–0039 alone. |
| F-2 | **high (blocking)** | merge state | Head does not merge with `origin/main-tools` (`1e7ecf07`): 7 content conflicts, 4 auto-merged files needing verification. PR head still `0d729713`. | Second sync onto `1e7ecf07`, same union discipline, **together with** F-1's renumber; re-run `pnpm check` + range gate. |
| F-3 | low | `readiness-review/readiness-iter-2.md:18,28,63,95,98,112,129,130`; `readiness-iter-3.md:18,28,62,68,78,80,97,111` | Readiness history is a hybrid: iters 3–6 were partially renumbered (0032→0036) while iters 1–2 were not, so two files still cite the non-existent `TDR-0031-harness-dispatch-outcome-envelope-detail.md` and twenty `TDR-0031` references across the two (ten each) now read as GH-293's unrelated engine-first record. Adjudication (o) says history keeps the id it reviewed. | With F-1, freeze readiness/review history at the ids it reviewed and add one line saying so; renumber only live artifacts (spec, test plan, plan, pm-notes, decision-review, spike evidence, code comments, spec pages). |
| F-4 | info | `tests/checks/decision-record.test.ts`; `scripts/checks/` | No invariant checks decision-id uniqueness, so `pnpm check` is green on a tree whose ids are already taken. The only id assertions are a fixed four-id list. | Add a repo check: front-matter `id` unique across `doc/decisions/**`, every index row matches an existing file and vice versa. |
| F-5 | info | `chg-GH-335-pm-notes.yaml` | The two notes describing this collision round are **uncommitted**; the reviewed commit records the first collision (0031→0037) but not this one. A third entry will be required after F-1. | Commit the notes with the re-sync; extend them to 0040–0043. |
| F-6 | info | `chg-GH-335-pm-notes.yaml` (gate note) | File count "1359" does not reconcile with the measured 1356; test counts (10791/4/0) do. | Correct to 1356 on the next touch. |
| F-7 | info | merge commit scope | The sync commit changes 168 files (159 code/doc/fixture/decision files plus GH-338's nine change artifacts), almost none inside any declared phase `scope.files`; a re-sync will add GH-339's files too. Inherent to a branch sync. | Record as an accepted scope deviation at `dod_check`. |
| F-8 | info (suppressed) | iteration-3 references | Iteration-3 residuals F-1…F-11 remain open and unchanged: Phase-10 scope under-declaration, the missing Phase-10 evidence note, the memoisation comment overclaim, the self-escaping single-home source guard, the spec 1.4 revision-log DEC-count clause, the unreachable fifth refusal shape, DM-10's missing stored-stamp clause, and the documentary nits. | Carry forward; not re-graded this iteration. |

Non-blocking observation not raised as a finding: `doc/overview/glossary.md` `related_decisions` widened
from GH-335's two old ids to all four records — a harmless superset (ascending, all real records).

## Plan and spec compliance

- **Spec compliance: PASS.** The merge changed the spec only by id substitution (18 lines, all
  `TDR-` text); no criterion, decision, DM or scope changed.
- **Plan compliance: PASS.** `plan validate` is `valid` on the merged tree; no phase declaration was
  altered. The sync commit itself sits outside phase scope (F-7).

## Next step

`CALL_CODER` — one mechanical pass: re-sync onto `1e7ecf07` resolving the seven doc conflicts as
unions, renumber the four records to TDR-0040–0043 across the live artifacts and spec pages, freeze the
history artifacts, then re-run `pnpm check` and the range gate. No change to behaviour, contracts, tests
or the reviewed properties is required.
