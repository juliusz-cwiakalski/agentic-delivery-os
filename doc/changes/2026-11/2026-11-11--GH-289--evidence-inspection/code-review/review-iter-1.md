# Code Review — GH-289 (M2-S12: Evidence inspection and divergence resolution)

- **Iteration:** 1
- **Mode:** local (ADOS review gate, `review_fix` input)
- **Branch:** `feat/GH-289/evidence-inspection` (22 commits; merge base `723454e4` on `main-tools`)
- **Artifacts reviewed:** `chg-GH-289-spec.md` v1.4 (36 ACs), `chg-GH-289-test-plan.md` v1.3 (39 TCs),
  `chg-GH-289-plan.yaml` revision 2.1 (5 delivery phases), `chg-GH-289-pm-notes.yaml`,
  `readiness-review/readiness-iter-{1,2,3}.md`, `doc/decisions/TDR-0024-*.md` (Proposed)
- **Machine record:** [`review-iter-1.yaml`](./review-iter-1.yaml) (same findings, reviewer schema)
- **Reviewed at:** 2026-11-11

## Verdict

**Status = FAIL** — no product defect was found, and the two criteria that are not
satisfied **as written** (AC-F2-2's text-printing clause, AC-F4-3's permission-denied
exit) are spec-wording defects where the delivered behaviour is the correct one. Four
**medium** evidence findings (delivered assertions narrower than the test plan declares,
in TCs that carry AC evidence) and six **low** findings must be closed in `review_fix`.
Every finding below is remediable inside the change's declared file scope: test
assertions, one help-entry line, spec AC wording, and one plan scope declaration. No new
scope is required and no source behaviour change is required.

What the change does well: the read side is a genuinely pure domain projection over an
injected app use case; the grammar is validated in the command module before any runtime
call (so no store read on a refusal, proven by a failing-store seam); repository scope is
enforced twice and discloses only a count; the divergence-count rule collapsed to one
exported domain function consumed by both surfaces with the list-length helper deleted;
the additivity guard (`acceptsAnyFlag` + handler guard) is a coherent, tested trade-off;
and every gate I re-ran on the change's own surfaces is green.

## What I verified (not taken on trust)

Suites (all re-run by me, `TMPDIR=$PWD/tmp/tmpdir`):

| Suite | Result |
|---|---|
| `dispatch-attempts-ref` / `-contract` / `-bounds` / `-digest` | 56 pass / 0 fail |
| `dispatch-attempts-scope` / `-refusals` / `dispatch-additive-stability` / `dispatch-divergence-count` / `dispatch-resolve-result` | 30 pass / 0 fail |
| `dispatch-attempts-count-rule` / `-taxonomy` / `-composition` / `dispatch-attempts-test-isolation` / `dispatch-resolve-composition` / `dispatch-help-version` / `dispatch-help-inventory` / `reference-page-parity` | 33 pass / 0 fail |
| `tests/behaviour/dispatch`, `tests/structure/dispatch`, `tests/conformance/dispatch`, `privacy-release`, `doc-conformance` (69 files) | 457 pass / 0 fail |
| `content-inventory` / `port-contract-inventory` / `subpaths` / `error-table-sync` / `exit-code-literals` / `privacy-literals` | 171 pass / 0 fail |

Gates I re-ran: `pnpm typecheck` (exit 0), `pnpm check:boundaries` (385 modules, 0
violations; ambient-globals, workspace-entrypoints, secret-read-boundary clean),
`check:prompt` (5 prompts clean), `check:help` (all prompt-required covered),
`exports-parity` (5 publishables), `forbidden-literals.ts` (clean), `privacy-literals.ts`
(0 violations), `bash scripts/.tests/test-doc-distribution.sh` (83 in-scope docs, no
drift), `plan validate GH-289` (`valid`, `tier=full`, `readyForDevelopment=true`).

`plan diff GH-289` could not run in this worktree (the CLI's `readDiff` port is
uncomposed and answers "repository diff … could not be read"); I performed the
scope comparison mechanically instead (per-phase declared `scope.files` vs each phase
commit's file list — see the plan-alignment table).

The aggregate `pnpm check` was re-run and finished 7288 pass / 4 skip / 24 fail, where
all 24 failures are 5 s-budget timeouts in unrelated pre-existing suites (`closeout`,
`capsule`, `watchdog`, `privacy`, `forbidden-literals`); 7288 + 24 = 7312, the delivered
pass count, and `privacy-ci-wiring` passes 14/14 when re-run alone — so the aggregate is
recorded as a host-load flake, not a regression (I-5). No GH-289 suite failed.

Code read in full: `packages/core/{contracts,domain,app}/dispatch-{attempts,gate,ledger}.ts`,
`packages/cli/src/{commands/dispatch,output/dispatch-text,edge,production,help}.ts`,
all new fixtures and suites, and the delivered documentation surface
(`feature-dispatch-engine.md`, `feature-result-contract.md`, `feature-cli-entrypoint.md`,
`feature-state-layer.md`, `feature-projects.md`, `test-spec-dispatch-engine.md`,
`m2/commands/attempts.md`, `m2/contracts.md`, `m2/{architecture,journeys,test-scenarios,entrypoint-delta}.md`,
backlog/status/registry, `doc/00-index.md`, `doc/overview/{architecture-overview,glossary}.md`,
`doc/decisions/00-index.md`).

## Findings

| ID | Sev | Location | Evidence | Required remedy |
|----|-----|----------|----------|-----------------|
| F-1 | medium | `tests/behaviour/dispatch-attempts-contract.test.ts:326` (TC-028 cells 1-3) | TC-028 step 2 and Appendix D are normative on the **envelope**: "exactly eight always-present keys plus `truncation` only when a bound binds". The delivered cell scans only for the five forbidden gate keys (`coverage`, `floor`, `verdict`, `eligibility`, `unmetConditions`) at any depth. No test asserts `Object.keys(data)` for the attempts envelope, so an undeclared envelope key (`ok`, `kind`, `command`, `refs[]`, a stray `truncated`) would pass. Row-level closure **is** asserted (`:212`). | In the same file add an exact envelope key-set assertion (sorted) for a page with and without a bound binding (e.g. `--limit 3` on 5 records vs a ledger-truncated read), so the `truncation` presence rule is pinned too. |
| F-2 | medium | `tests/behaviour/dispatch-divergence-count.test.ts:43` (TC-022) | Two declared cells are absent. **(a)** TC-022 step 3 requires an **unmigrated-root baseline** proving the repository scope moves nothing where nothing is foreign (`28/3/25`); every delivered fixture is either migrated (foreign records present) or tiny, so AC-F7-1's "unchanged on an unmigrated root" half has no suite cell. **(b)** TC-022 step 2 / TC-028 step 4 require the human `unresolved_divergences=` line to print "exactly those 20 identifiers and nothing else"; `unresolved_divergences=` is asserted nowhere for the >20 case (only `tests/fixtures/dispatch/golden/summary.txt` with one identifier), although the renderer (`dispatch-text.ts:73`) prints `unresolvedIds` correctly. | Add (a) a 25-open + 3-resolved, **no-foreign** fixture asserting `28/3/25` with `idsTruncated: true`, and (b) a text-form assertion on the >20 block whose `unresolved_divergences=` value equals `unresolvedIds.join(",")` (20 ids). |
| F-3 | medium | `tests/behaviour/dispatch-attempts-scope.test.ts:146` (TC-014) | TC-014 declares counters, sha256 evidence, a torn-binding-marker cell, a project-checkout-identity-marker cell, both invocations, and host-index write counts. Delivered asserts only: `evidenceFiles(snapshotStore(...))` equality over files named `ledger*` using **size:mode:mtimeMs** (`attempts-production.ts:53`), record counts, and binding-marker absence. Concretely missing: `append === 0` / `acquireFence === 0` / `releaseFence === 0` on a *successful* read (only refusal paths use `counters.append`), sha256 ("bytes unchanged" is nominal — a same-size rewrite passes unless mtime moves, against TR-2's "sha256 is the primary evidence"), the torn-binding cell (step 6), the project-marker cell (step 7 — `projectIdentityMarker()` is exposed but never called; `readStoreFile` is exported and never used), the second (text) invocation, and the host-index write count. | Wire the existing capabilities: `countStore` counters around a successful `harness.read`, `createProductionProjectsHarness(...).snapshot` (sha256) in `evidenceFiles`, a torn `dispatch-identity.json` cell, `projectIdentityMarker()` before/after, a text-form invocation, and `hostIndexAccess` write counts; or narrow the TC-014 steps to what is asserted. |
| F-4 | medium | `tests/structure/dispatch-attempts-composition.test.ts:32`; `packages/cli/src/help.ts:435` | TC-029 step 3 requires the `dispatch attempts` help text to name `dispatch dual-run summary --repo …`, and the test's own docstring claims "the family help entry **and** the `dispatch attempts` help entry all name `dispatch dual-run summary --repo ...`". The assertion at `:38` only checks `attempts.summary` contains "attempt"; the delivered entry (`help.ts:435-447`) names no summary, so the comment and test-plan §10's "both help surfaces" are inaccurate. AC-F7-2 is still satisfied through the family entry's usage line (`help.ts:410`), so this is an evidence/wording defect, not a behaviour break. | Add one pointer line to the attempts help entry (e.g. summary or a `Examples`/`Notes` line naming `dispatch dual-run summary --repo <repo>` for coverage and floor) and assert it in TC-029 step 3; or correct the test docstring and the §10 row to "the family help entry". Keep the five-entry pin and inventory cells unchanged. |
| F-5 | low | `chg-GH-289-spec.md:448` (AC-F2-2); `packages/cli/src/output/dispatch-text.ts:121` | AC-F2-2 ends "…and **all three are printed unmodified in text**". The declared digest row grammar (F-6, AC-F6-1, the golden `attempts.txt`) prints only `startedAt`; `endedAt` and `recordedAt` are machine-only. The two criteria contradict each other, and the implementation follows the specific one (F-6/AC-F6-1). TC-007 correctly asserts only the machine values plus the first cell, so this is a spec defect, not an implementation gap. | Correct AC-F2-2 to "the digest prints `startedAt` unmodified" (machine `endedAt`/`recordedAt` equal their stored values). Record the change in spec §25 history. No code change. |
| F-6 | low | `tests/behaviour/dispatch-attempts-ref.test.ts:192` (TC-039) | TC-039 declares six ref cells (`241`, `gh-241`, `GH-`, `GH241`, `GH-241-extra`, `""`), a "summary names the supplied value and the expected uppercase canonical shape" assertion, and a byte-identical store snapshot. Delivered covers one ref cell (`241`), the unknown flag, and one positional; the summary text/byte-snapshot assertions are replaced by an append counter. The refusal identity (exit 1, `input.value.rejected`, zero reads, no `attempts.*`) is asserted, which is the AC-F1-6 core. | Extend the cell list to the declared shapes and assert the refusal summary names the supplied value; either restore the byte comparison or state the counter as the declared observable. |
| F-7 | low | `tests/structure/dispatch-attempts-count-rule.test.ts:24` (TC-038) | TC-038 declares an AST parse over `packages/**/src` with an import-graph scan, step 5 ("the computation's signature admits a repository scope, and both call sites pass one"), and a repo-wide absence scan. Delivered is substring scans over two files plus a five-file absence list; `domain.includes("summarizeRepositoryDivergences(input.divergences")` is a formatting-sensitive string check. The behavioural half is strong (25 → 25 with 20 ids), so detection power is mostly preserved. | Either implement step 5/6 as declared (an import-graph or AST check with file:line reporting), or narrow the TC-038 steps and the §8.4 note to the delivered string-scan discipline. |
| F-8 | low | `tests/checks/dispatch-attempts-test-isolation.test.ts:23` (TC-036) | `NEW_SUITES` lists 11 of the 13 new suites; `tests/structure/dispatch-attempts-composition.test.ts` is omitted, so "every new suite" is not literal (it does route through `createAttemptsHarness` → `APPROVED_BASE`, so no violation exists — the scan is just incomplete). | Add `tests/structure/dispatch-attempts-composition.test.ts` to `NEW_SUITES` (self-exclusion may stay explicit). |
| F-9 | low | `packages/cli/src/commands/dispatch.ts:117` | `DELIVERED_FLAGS` re-declares the definition's flag vocabulary instead of deriving it from `flags` + `requiresValue` (`:216-217`). A future flag added to the definition but not to this set is silently refused as `fallback.invocation` on all four delivered forms — a drift hazard the parser used to handle mechanically. | Derive the allowed set from the definition (`new Set([...definition.flags, ...definition.requiresValue])`) or add a structural assertion that the two agree, with a comment naming the coupling. |
| F-10 | low | `chg-GH-289-plan.yaml` phase 3 scope vs commit `b95695dc` | Plan scope alignment is otherwise exact (see table), but phase 3 modified `tests/behaviour/dispatch-additive-stability.test.ts`, which only phase 2 declares. The plan itself assigns TC-034 cells 2-3 to phase 3, so the declaration is the omission, not the edit. | Add `tests/behaviour/dispatch-additive-stability.test.ts` to phase 3's `scope.files` (or to the change-folder note that a shared suite is intentionally co-owned by phases 2 and 3). |
| I-1 | info | `chg-GH-289-spec.md:457` (AC-F4-3) | AC-F4-3 says a permission-denied read "exits `2`"; the delivered `state.permission.denied` row projects `user-validation` and exits `1`, and the reconciled pages state that truth. Declared as a deviation in the delivery; the spec AC was not corrected. | Correct AC-F4-3 to "each exits with that row's delivered projection (`state.permission.denied` → 1; platform state rows → 2)". No code change. |
| I-2 | info | `packages/cli/src/commands/dispatch.ts:220` | `positionals: { max: 3 }` means a tail longer than `dispatch attempts a b` (4+ tokens) is refused by the shared parser as `fallback.invocation`, not by the module grammar as `input.value.rejected`. AC-F1-6's single-unexpected-positional cell is satisfied; only the overflow path differs. | Optional: raise the positional ceiling and let the module answer, or document the boundary. |
| I-3 | info | `packages/core/src/app/dispatch-attempts.ts:63` | The unresolvable-identity refusal names "this checkout" generically where §10 says the summary should "name the checkout" (the context refusal does name its file). AC-F3-3 is satisfied in substance (`input.value.rejected`, exit 1, no store read, no `unbound` store). | Optional: interpolate the checkout path through an injected port. |
| I-4 | info | `packages/cli/src/output/dispatch-text.ts:99` | `utf8Bytes` duplicates the domain `utf8Length` (`domain/dispatch-attempts.ts:36`). Two implementations of one declared bound. | Optional: export the domain helper (or hoist it to a shared neutral module) and consume it in the renderer. |
| I-5 | info | full-tree gate | My aggregate `TMPDIR=$PWD/tmp/tmpdir pnpm check` run on this (loaded) host finished **7288 pass / 4 skip / 24 fail**, and every failure is a 5 s-budget timeout in a suite this change does not touch (`closeout`, `capsule`, `watchdog`, `privacy`, `forbidden-literals`); `privacy-ci-wiring` passes 14/14 when re-run alone. 7288 + 24 = **7312**, exactly the delivered `pnpm check` pass count, which corroborates that the delivery's green aggregate is real and that this run's 24 failures are host-load flakes, not regressions. No GH-289 suite failed. | The runner must re-run the aggregate on a quiet host before `dod_check`; do not treat this review's aggregate failure count as evidence of a regression. |

## Acceptance-criteria status (36/36 traced)

| AC | Status | Evidence / note |
|----|--------|-----------------|
| AC-F1-1 | satisfied (suite) | `dispatch-attempts-ref.test.ts` flag + active-change cells; `refSource`, `limit`, page size |
| AC-F1-2 | satisfied (suite) | absent / unparsable / no-active-change; summary carries the context path and `--ref`; `readCount 0`, append count unchanged |
| AC-F1-3 | satisfied (suite) | `1`, `100`, default 20; `0 101 -1 abc 07 +7 " 7" 001` and missing value refused, no normalisation, `readCount 0` |
| AC-F1-4 | satisfied (suite) | total order, opposite insertion orders, two runs |
| AC-F1-5 | satisfied (suite) | `matched`/`hasMore` at 3-of-3, 2-of-3, 0 matches |
| AC-F1-6 | satisfied (suite) for the declared cells | one ref shape, unknown flag, one positional; tail-overflow differs (I-2); cell breadth narrower than TC-039 declares (F-6) |
| AC-F2-1 | satisfied (suite) for rows | exact sixteen-key row set with absent-key checks; **envelope** closed set unasserted (F-1) |
| AC-F2-2 | machine half satisfied; **text clause not satisfiable** | `endedAt`←`finishedAt` one-to-one, instants unmodified, corroboration triple; digest prints only `startedAt` (F-5) |
| AC-F2-3 | satisfied (suite) | `not-applicable` → `token: null` + `outcome: not-applicable`; comparing row keeps stored values |
| AC-F2-4 | satisfied (suite) | 100 maximal rows ≤ 65,536 B, page scope `bound: 65536`, non-zero `omittedRecords`, `hasMore`; small page carries no `truncation` |
| AC-F2-5 | satisfied (suite) | 5,001 → ledger scope `bound: 5000` omitted 1, newest kept, `matched ≤ 5000` |
| AC-F3-1 | satisfied (suite) | two checkouts one host root, foreign count 0 in both, own rows only |
| AC-F3-2 | satisfied (suite) | migrated root: 3 own of 6, foreign count 3, independent of `--ref`, no foreign identifier/reference in text |
| AC-F3-3 | satisfied (suite) | outside any checkout → exit 1 `input.value.rejected`, no data, no binding marker; message names the checkout generically (I-3) |
| AC-F4-1 | satisfied (suite, partly) | evidence files, record counts, binding marker; **counters/sha256/torn-marker/project-marker cells missing** (F-3); side-effect enumeration review-verified below |
| AC-F4-2 | satisfied (suite) | exit 0, `attempts: []`, `matched: 0`, `hasMore: false`, no error; empty digest golden |
| AC-F4-3 | **not satisfied as written** | torn/unknown → exit 2; permission-denied → exit 1 per the delivered row (declared deviation, I-1); spec wording must be corrected |
| AC-F4-4 | satisfied (suite + review) | `ERROR_TABLE` 124 with 4 `dispatch` rows; no `attempts.*` in table/help/spec/output **and** none in the M2 page or corpus (I verified both by reading) |
| AC-F5-1 | satisfied (suite) | `mode`/`repository`/`state`/`resolved`, counts move by exactly one, id leaves the list, five delivered keys first |
| AC-F5-2 | satisfied (suite + review) | resolve composition has no credential/transport/spawn port; `spawns 0`, `requests []` |
| AC-F5-3 | satisfied (suite) | replay appends nothing, `resolved: false`, stored note/principal, identical counts, open record byte-identical |
| AC-F5-4 | satisfied (suite) | blank and whitespace notes refused, nothing appended; 400-char note stored and reported at 240 |
| AC-F5-5 | satisfied (suite) | 25 open: exact count, 20 ids, `idsTruncated: true` on both blocks, delivered field order, no list-length derivation |
| AC-F6-1 | satisfied (suite + golden) | summary line, seven cells newest-first, pointer last, no run-form keys |
| AC-F6-2 | satisfied (suite) | closed three-value derivation |
| AC-F6-3 | satisfied (suite) | ≤ 40 lines / 8,192 B, oldest dropped, declared cut, ≤ 37 rows, `has_more` untouched |
| AC-F6-4 | satisfied (suite) | byte-identical text, structurally identical machine data |
| AC-F6-5 | satisfied (suite) | the declared one-line resolve digest, replay prints `appended=false` |
| AC-F7-1 | satisfied for no-gate-keys + narrowing; **unmigrated-root half unasserted** | the recursive forbidden-key scan and the summary block assertions hold; no cell proves "unchanged where nothing is foreign" (F-2) |
| AC-F7-2 | satisfied | digest pointer and family help synopsis name the summary; reference page carries the pointer; the attempts entry does not (F-4) |
| AC-F8-1 | satisfied (suite) | help renders usage/options/global block/example/exit codes; root listing 17 families, no `attempts` row |
| AC-F8-2 | satisfied (suite) | `check:help` green, parity pin 5 with a retitled test, coverage inventory row, see-also resolves |
| AC-F8-3 | satisfied except the literal `command: "dispatch"` | page documents `--help`/`--version`, the resolved exit table, singular `divergenceRef`, the digest + pointer, the bounds; it states the delivered five-field envelope instead of printing `command:` (declared deviation R2; the pack/spec wording is what is stale) |
| AC-F8-4 | satisfied (review-verified) | backlog M2-S12 marker, status snapshot, entrypoint-delta observed composition, registry subfamily note, `attempts.v1` refinement, dispatch spec grammar/read-side/resolve/error/bounds — all read and consistent with the code |
| AC-F9-1 | satisfied (suite + review) | run/summary/handover/resolve key order pinned; four delivered forms refuse an undeclared flag at `fallback.invocation` exit 1 through a throwing store seam; the diff against the merge base renames, retypes, and reorders nothing delivered; the only additions are the declared ones |
| AC-F9-2 | satisfied (suite + review) | scans green; `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/*/package.json` diff against the merge base is empty; one five-package minor changeset; no `ados` literal added |

## Plan-phase alignment

| Phase | Commit | Declared files | Alignment |
|-------|--------|----------------|-----------|
| 1 | `415395f8` | 15 | exact; `TDR-0024`/`decisions/00-index.md` deliberately untouched (work item 1.1 verifies presence only) |
| 2 | `a40c4bc8` | 19 | exact; the changeset landed here (declared deviation: the release gate reds any boundary with a `packages/` diff without it) plus the pm-notes phase write |
| 3 | `b95695dc` | 19 | 19/19 declared touched-or-intentionally-not (`dispatch-bounds.test.ts` unchanged by design, `attempt-records.ts` declares-but-unused); one **extra** edited file, `dispatch-additive-stability.test.ts` (F-10) |
| 4 | `9d56ebeb` | 6 | exact |
| 5 | `6bd89e5f` | 15 | exact; the changeset is verified-not-touched here as declared |
| phase 7 (`system_spec_update`, `c77e4de7`) | — | lifecycle, not a plan phase | also edited `doc/00-index.md`, `doc/overview/{architecture-overview,glossary}.md`, `m2/{architecture,journeys,test-scenarios}.md` — legitimate doc-syncer scope; all edits read and consistent with delivered truth; `test-doc-distribution.sh` green |

Every plan phase has a pm-notes `notes:` entry naming the plan phase id, the commit SHA,
and its test result (`pm-notes.yaml:218,243,274,296,315`). No plan phase is open.

## Test-plan alignment (other than the findings above)

- All 39 TCs map to the file named in §7.1 and those files exist and pass.
- The six §10 review-verified rows are **genuinely review-only** and I discharged each:
  TC-014 side-effect enumeration (delivered code has no append/fence/credential/transport
  call on the read path; the only writes are the inherited host-index maintenance and the
  create-once project marker), TC-017 M2-page/corpus string absence (none), TC-029
  reference-page half (page prints the pointer, computes no gate), TC-032/TC-033
  (documentation verified by reading), TC-034 cell 6 (additive-only diff), TC-035
  lockfile/manifest diff (empty).
- Evidence-class labels are otherwise honest: nothing marked review-verified is
  suite-asserted and nothing marked suite is missing a suite. The four medium findings are
  *narrower-than-declared* assertions inside genuinely present suites, not mislabelled
  classes.

## Accepted residual risks — confirmed, none worsened

- **R1/R2** (envelope `ok`/`command`/`kind`): the implementation follows the delivered
  five-field `CommandResult`; cell 7 asserts `error.code` + exit 1 because no `kind` field
  exists (R3), and the M2 page/spec state the delivered envelope. Not worse.
- **R3**: cell 7 uses `--json`, so `error.code` is assertable — confirmed.
- **R4**: TC-034's harness preconditions are satisfied by `createAttemptsHarness` /
  `createCommandScenario`.
- **R5**: pm-notes phase mirror — the registry is authoritative; the five plan-phase notes
  are consistent with the five commits.

## Next step

`CALL_CODER` → `review_fix` with F-1…F-10. The remediation set is: five suites
(`dispatch-attempts-contract`, `dispatch-divergence-count`, `dispatch-attempts-scope` +
`attempts-production` fixture, `dispatch-attempts-composition`, `dispatch-attempts-ref`,
`dispatch-attempts-count-rule`, `dispatch-attempts-test-isolation`), one line in
`packages/cli/src/help.ts`, the `DELIVERED_FLAGS` derivation in
`packages/cli/src/commands/dispatch.ts`, AC-F2-2/AC-F4-3 wording in the spec, and one
phase-3 scope row in the plan. Then re-review (iteration 2).

Per the review brief for this session I did **not** append a remediation phase to
`chg-GH-289-plan.yaml`; this artifact plus `review-iter-1.yaml` are the only files written.
