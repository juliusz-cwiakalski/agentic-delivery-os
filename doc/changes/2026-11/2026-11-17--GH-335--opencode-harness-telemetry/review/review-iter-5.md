# Code Review — GH-335 — Iteration 5 (final re-review after the second sync)

**Work item:** GH-335 · **Branch:** `feat/GH-335/opencode-harness-telemetry` · **PR:** #357 → `main-tools`
**Mode:** local · **Reviewed head:** `2b58d401` (third renumber pass on top of merge `1e554edc`, which merged
`origin/main-tools` `1e7ecf07` into `c4f519dc`)
**Base as reviewed:** `origin/main-tools` `1e7ecf07`, re-checked during the review: `main-tools` **moved to
`3bbd9466`** (PR #362) — see §7.
**Date:** 2026-11-18 · **Previous verdict:** iteration 4 `FAIL` (F-1 ids taken, F-2 unmergeable, F-3 hybrid history)

---

## Verdict

**Status = PASS.**

Iteration 4's two blocking findings are genuinely closed, F-3 is resolved, the unions lose nothing, and the
head merges cleanly with the branch the PR targets — including after `main-tools` advanced mid-review.

- **F-1 (ids taken) — closed.** The four harness records are now **`TDR-0040`** (seat/spawn), **`TDR-0041`**
  (envelope detail), **`TDR-0042`** (integration mode) and **`TDR-0043`** (adapter contract). `origin/main-tools`
  still has **`0039` as its highest** decision id, no `TDR-004x` existed before this branch, the ids are unique
  across the tree and the hypothetical merge, every front-matter `id` equals its filename, and index/register
  agree with the directory. GH-338's `0032–0035` and GH-339's `0036–0039` are untouched, byte-for-byte.
- **F-2 (unmergeable) — closed.** `git merge-tree --write-tree HEAD origin/main-tools` exits **0** with a clean
  tree against **both** `1e7ecf07` (`b6051586`) and the newly-moved `3bbd9466` (`664e787a`). PR #357's head is
  the reviewed commit `2b58d401` and GitHub reports `mergeable: MERGEABLE`.
- **F-3 (hybrid readiness history) — closed.** `review/` and `readiness-review/` are byte-identical to the
  pre-sync reviewed state (`git diff 0d729713 HEAD` shows only iteration 4's own two new files), and each
  history file cites exactly the record ids that existed when it was written. Five stale path strings survive,
  only inside that frozen history (§4).
- **Unions — nothing lost.** The seven conflicted files and the four auto-merged files carry both parents'
  content; `production.ts` still carries both GH-338's transport selection and GH-335's harness composition.
- **Gates** are green. The only red assertions were two environment-coupled tests hit by a *duplicate*
  `pnpm check` running in the same checkout at the same time; each passes in isolation and the co-scheduled
  group passes together (§6).

Six non-blocking findings are recorded: two low and four info. None affects the delivered behaviour, the spec,
the decision records or mergeability.

---

## 1. Decision-id allocation (F-1) — verified on the pushed head

| Check | Result |
|---|---|
| highest TDR id on `origin/main-tools` (`3bbd9466`, after the mid-review move) | **TDR-0039** — `0036–0039` are GH-339's, `0032–0035` GH-338's |
| any pre-existing `TDR-004x` on the base at any point | none (`git ls-tree origin/main-tools`; PR #362 adds no decision record) |
| GH-335 records on HEAD | `TDR-0040` seat/spawn · `TDR-0041` envelope detail · `TDR-0042` integration mode · `TDR-0043` adapter contract |
| duplicate front-matter ids across `doc/decisions/**` | **0** (63 records, every `id` unique) |
| front-matter `id` == filename prefix | **63/63** (the only mismatch is the register's pseudo-id `DECISION-REGISTER`) |
| duplicate ids in the hypothetical merge tree | **0** (`b6051586` and `664e787a`) |
| `doc/decisions/00-index.md` | 61 rows, no duplicate rows, no link to a missing file; `0040–0043` appended ascending after `0039` |
| `doc/decisions/00-register.md` | harness-adapter row cites `TDR-0042` + `TDR-0043` (same shape as before, `0034/0035 → 0038/0039 → 0042/0043`) |
| GH-338 / GH-339 change folders vs base | **byte-identical** (no `004x` citation inside them; no renumber leaked outward) |
| GH-338 / GH-339 code vs base | untouched (`packages/testkit/src/conformance/{parity,stateful-double,tracker-error-taxonomy}.ts`, fixtures, conformance tests all identical) — the only change under `conformance/` is GH-335's own `harness.ts` (+200/−7) |
| record cross-references | `0040`↔`0041`↔`0042`↔`0043` and the pre-existing `ADR-0008`/`TDR-0016`/`TDR-0021` links resolve; no `003x` id survives inside the four records |

The records themselves are tracked, `Proposed`, and the shipped test that pins them
(`tests/checks/decision-record.test.ts`) reads `0040–0043`.

## 2. Mergeability (F-2) — clean, including after the base moved

```
git merge-tree --write-tree HEAD origin/main-tools   # 1e7ecf07 → tree b6051586, exit 0, no conflict output
git merge-tree --write-tree HEAD origin/main-tools   # 3bbd9466 → tree 664e787a, exit 0, no conflict output
```

`git diff --stat HEAD 664e787a` is **exactly** the base's new seven files and nothing else — the merge adds
PR #362's planning docs, its registry line and its section-headings fixture, and leaves every HEAD line
untouched. `gh pr view 357`: head `2b58d401`, base `main-tools`, `mergeable: MERGEABLE` (`mergeStateStatus:
BEHIND`, because the branch has not been re-synced onto `3bbd9466` — not a conflict).

## 3. History freeze (F-3) — verified per file

- `git diff 0d729713 HEAD -- …/review …/readiness-review` → **only** the two new `review-iter-4.*` files.
  Every other history file is byte-identical to the pre-sync reviewed state.
- Independently, each file's id set equals the id set at the commit that introduced it:

| File | ids at introduction | ids at HEAD |
|---|---|---|
| `readiness-iter-1.md` | `TDR-0027` | same |
| `readiness-iter-2.md` | `TDR-0031` | same |
| `readiness-iter-3.md` | `TDR-0031`, `TDR-0032` | same |
| `readiness-iter-4…6.md` | `0030–0033` (+`0016/0021/0027/0028`) | same |
| `review-iter-1…3.{md,yaml}` | `0034/0035` | same |

The history therefore keeps the ids it actually reviewed, exactly as adjudication (o) requires, and the
third renumber did not create a third variant.

## 4. No wrong-direction renumber

Direction audit over every `TDR-` citation in the tree (docs, code comments, fixtures, tests):

| Id range | What every live citation denotes | Evidence |
|---|---|---|
| `0032–0035` | GH-338: CLI-first transport, completion-contract extensions, bounded discussion bodies, Issues transition map | `feature-provider-client-seeds.md`, `feature-adapter-ports.md`, `ADR-0005`'s editorial pointer, `packages/adapters/src/github/{cli-transport,workflow-map,thread-discussion}.ts`, GH-338 change folder |
| `0036–0039` | GH-339: parity matrix, tracker error taxonomy, simulated stateful double, registration-only extensibility proof | `feature-adapter-conformance.md:239–242`, `feature-adapter-reference-behavior.md`, `architecture-overview.md`, `adjudication.json`, `packages/testkit/src/conformance/*`, GH-339 change folder |
| `0040–0043` | GH-335: seat/spawn, envelope detail, integration mode, adapter contract | `feature-harness-adapters.md`, `glossary.md`, `spend/state-layer/session-database-admin/telemetry-v2/result-contract`, all harness code comments, GH-335 artifacts |

Live GH-335 artifacts cite `0040/0041` (spec, test plan, plan) or `0040–0043` (decision review, spike evidence)
and nothing else; the three surviving `TDR-0031` mentions in the plan/test plan are explicit
disambiguations naming it as GH-293's unrelated engine-first record.

**Stale path strings — five, all inside the frozen history and none in a live artifact:**

1. `readiness-review/readiness-iter-2.md:28` — `TDR-0031-harness-dispatch-outcome-envelope-detail.md`
2. `readiness-review/readiness-iter-3.md:28` — same `0031` path
3. `readiness-review/readiness-iter-3.md:28` — `TDR-0032-harness-seat-spawn-cardinality-and-seat-resolution.md`
4. `readiness-review/readiness-iter-5.md:45` — same `0032` path
5. `readiness-review/readiness-iter-6.md:45` — same `0032` path

(iteration 4's own `review-iter-4.md:167` / `review-iter-4.yaml:85` carry the `0031` path; they are history too
and are left unchanged.)

## 5. The unions still lose nothing

Seven content conflicts, diffed against **both** parents:

| File | GH-339-side content in HEAD | GH-335-side content in HEAD |
|---|---|---|
| `doc/00-index.md` | parity matrix / nine clause ids / error taxonomy / double / registration proof in the conformance row; "parity bar" reference-behavior row | harness conformance registry, six-scenario floor, four extension scenarios in the same row |
| `doc/decisions/00-index.md` | rows `TDR-0036…0039` with GH-339 filenames | rows `TDR-0040…0043`, ascending |
| `doc/overview/glossary.md` | parity matrix / parity dimension rows; `GH-339` in `related_changes` | *Integration mode* and *Harness seat binding* rows; `TDR-0040…0043` in `related_decisions` |
| `feature-adapter-conformance.md` | parity matrix, adjudicated register, tracker taxonomy, stateful double, registration proof, parity-gate evidence files | harness registry, `HARNESS_CONFORMANCE_FLOOR_SCENARIOS` + alias, extension scenarios, refusal map, `TDR-0043` |
| `feature-adapter-ports.md` | parity-is-not-a-port sentence; `TDR-0036` | carrier-selection sentence; `TDR-0040`/`TDR-0043`; `GH-339` in `related_changes` |
| `feature-result-contract.md` | "Conformance tracker class vocabulary" bullet; `GH-339`; error-table row set | four `harness.*` rows, `detail.harness` prose, `TDR-0041` |
| `doc/spec/nonfunctional.md` | parity-gate NFR paragraphs and their evidence files; `GH-339` | harness version-gate / observed-store NFR paragraphs |

Auto-merged but both-touched — verified line-level, no loss:

| File | Evidence |
|---|---|
| `packages/testkit/src/index.ts` | capsule export block present (moved to lines 38–40), plus GH-339's conformance exports |
| `tests/structure/conformance-coverage.test.ts` | GH-339's `TC-HARN-004` block present as `TC-HARN-004 / TC-HARNESS-031/032` and switched to the `FLOOR_SCENARIOS` alias |
| `tests/structure/content-inventory.test.ts` | both sides' inventory entries present (`boundLastMessage`, `COMMAND_FAILURE_DETAIL_MAX_CHARS`) |
| `tests/structure/inventory.json` | GH-339's `metrics*` entries still present at lines 170–171 (the diff shows only relocation, not removal) |

`packages/cli/src/production.ts` differs from the branch parent by **5 changed lines, all TDR id comments**,
and from the base by +593/−6. It carries GH-338's `resolveTransportSelection` path
(`createGithubCliTransport`/`createGithubNativeTransport`, degradation notice, `githubTransportSelection`) and
GH-335's harness composition mount (`createHarnessProfilePort` over `harnessFor(kind, dispatchVersionGate)`,
memoised `resolveProfileContext`, `resolveBinding`, `harnessAdmission`, `harnessFacts`). No transport line was
removed relative to the base.

No file was deleted relative to either parent, and there is no conflict marker in the tree.

## 6. Gates on this head

Run in this checkout (`TMPDIR=$PWD/tmp/tmpdir`). Two further `pnpm check` runs (a sibling worktree and a
duplicate run in this same checkout) were executing concurrently, which matters for the two red lines below.

| Stage | Result |
|---|---|
| `pnpm lint` | **PASS** — 3034 files, 0 errors (the pre-existing `useIndexOf` advisories only) |
| `pnpm format:check` | **PASS** — 2888 files, no fixes |
| `pnpm typecheck` | **PASS** — 6 packages + `tests/types` |
| `pnpm test` | `10964` tests / `1366` files: **10959 pass · 4 skip · 1 fail** (`TC-EXIT-002`) — flake, see below |
| `pnpm check:boundaries` | **PASS** — 466 modules / 1469 deps; ambient-globals 224 clean; workspace-entrypoints OK; secret-read-boundary 432 files clean |
| `pnpm check:memory` | **PASS** — 3 records / 8 areas / 0 errors |
| `prompt-conformance` / `help-guide-coverage` / `exports-parity` | **PASS** — 5 prompts clean; all prompt-required commands covered; 5 publishables |
| `scripts/.tests/test-doc-distribution.sh` | **PASS** — 96 in-scope docs, no drift |
| `./scripts/lint-commit-range.sh --base origin/main-tools` | **PASS** — 49 commits, 0 offending, 0 rules hit |
| `delivery-os plan validate GH-335` / `delivery-os lint plan GH-335` | **valid** / **valid** (`readyForDevelopment: true`) |

**The one red assertion is an environment race, not a change defect.**

- My run failed **`TC-EXIT-002` — "the live tree is clean and the scope is reported"**
  (`tests/checks/exit-code-literals.test.ts:65`), because the *other* concurrent check was writing
  `packages/core/src/domain/.mutant-telemetry-m10.ts` into the shared checkout at that instant. The file is
  gone (`rmSync` in `finally`); `git status --porcelain` is empty.
- The duplicate run in this same checkout failed a *different* test, **`TC-BIN-055`** hermeticity
  (`~/.jaiship-state` mtime moved while another run was active) — so each run failed exactly one
  environment-coupled assertion, and not the same one.
- **Isolation evidence:** `bun test tests/checks/exit-code-literals.test.ts` → **15/15 pass (4.3 s)**;
  `bun test tests/checks/install-launcher-installer.test.ts` → **11/11 pass (65.7 s)**;
  and the co-scheduled group `exit-code-literals + telemetry-mutants + harness-mutants + action-mutants +
  spend-mutants` → **102/102 pass (5.5 s)** in one process.
- The tree-clean assertion is coupled to *any* process writing into the checkout (see finding F-2 below). CI
  runs one check per checkout, so this does not gate the change; it did, however, make two simultaneous
  local runs red on different lines, which is the historical "load-sensitive" class iterations 2–4 also saw.

`main-tools` count note: this head reports **1366 files / 10964 tests**, not the 1359 / 10791 in the older
pm-notes gate note (finding F-3).

## 7. `main-tools` moved during this review — no fresh collision

`origin/main-tools` advanced **`1e7ecf07` → `3bbd9466`** (`docs(M4/M5): core-readiness assessment for a future
UI and its constraints (#362)`) while this review was running. Re-checked against the new head:

- the move is **docs-only** (7 files: m4/m5 planning docs, `forbidden-literals.registry.json`, the
  milestone-attachment section-headings fixture);
- it **adds no decision records** — the highest TDR id is still **0039**, `004x` is still free, no duplicate
  ids appear, so **there is no fresh collision** with `TDR-0040…0043`;
- `git merge-tree HEAD 3bbd9466` is **clean** (`664e787a`), and the merged tree differs from HEAD only by
  PR #362's seven files — no file the branch modified is touched by it.

The only consequence is that the branch is now one commit *behind*; it needs no re-sync for correctness, and
the PR still reports `MERGEABLE`.

---

## Findings (iteration 5)

**Blocking:** none.

**F-1 · low · documentation accuracy — the pm-notes history compresses the record's id path.**
`chg-GH-335-pm-notes.yaml:343` now says the envelope record "was renumbered TDR-0031 -> TDR-0041" for the
GH-293 collision, and `:367` repeats "after the TDR-0031 to TDR-0041 renumbering", while `:591` (correctly)
says the same record went "0031 to 0033 earlier today". The actual path was **0031 → 0033 → 0037 → 0041**.
The text drifted because each sync's id substitution rewrote the previous note; it is narrative only (the
`decisions:` list and every live artifact are correct). Fix: on the next pm-notes touch, state the chain once
and stop rewriting history notes.

**F-2 · low · test isolation — the clean-tree assertion is coupled to tree-writing mutant suites.**
`tests/checks/exit-code-literals.test.ts:65` asserts `git status --porcelain` is empty. Several suites write
temporary mutants *into the source tree* (`telemetry-mutants` `.mutant-telemetry-*`, `action-mutants`/
`spend-mutants` `.mutant-*`, `metrics-mutants` `.metrics-mutant-*`, and this change's expanded
`harness-mutants` `.__mutant_*`, +584 lines). Any second process in the same checkout turns the gate red at
random. Two simultaneous checks here each failed one such assertion, differently, and all of them pass in
isolation and together in one process. Not blocking (CI runs one check per checkout), but the assertion
measures the machine. Fix: write mutants to a temp root (as `coordinator-mutants` and `privacy-support`
already do), or compare against a scoped `git status -- <scanned paths>`.

**F-3 · info · stale gate counts in pm-notes.**
`chg-GH-335-pm-notes.yaml:620` records "10791 pass / 4 skip / 0 fail across 1359 files"; this head measures
**10964 tests / 1366 files** (10959 pass / 4 skip, plus the isolation-only flake). Carry-over of iteration-4
F-6; superseded by the run above.

**F-4 · info · no automated decision-id uniqueness invariant (carry-over of iteration-4 F-4).**
The third collision was again caught only by manually listing `doc/decisions/**` and diffing against the base.
`tests/checks/decision-record.test.ts` pins a fixed four-id list, which cannot detect a collision. Suggested
check (beside `memory-lint`): front-matter ids unique across `doc/decisions/**`, `id` == filename, index rows
and directory agree both ways.

**F-5 · info · `doc/decisions/00-index.md` omits `ODR-0002` and `ODR-0003`.**
Present identically on `origin/main-tools` (`1e7ecf07` and `3bbd9466`), so pre-existing and out of scope for
this change; noted so the next index edit does not inherit it silently.

**F-6 · info · suppressed — iteration-3/4 informational carry-overs remain open.**
Phase-10 scope under-declaration and the missing Phase-10 evidence note, the memoisation comment overclaim,
the self-escaping single-home source guard, the spec 1.4 revision-log DEC-count clause, the unreachable fifth
refusal shape, DM-10's missing stored-stamp clause, and the documentary nits. None is re-graded here; no
blocking item depends on them.

---

## Method

Diffed the reviewed head against both parents (`c4f519dc` and `1e7ecf07`, and again against `3bbd9466`); listed
the files both sides touched since the merge base `ec1a2626` (11: the 7 conflicts + 4 auto-merged) and checked
each side's content in the result; compared every history file with `0d729713` and with the commit that
introduced it; audited id direction over the whole tree; enumerated all `TDR-…md` references for dangling
paths; counted ids/front-matter/index/register consistency; ran the full gate battery plus `plan validate`,
`lint plan`, the doc-distribution test and the branch-range commit gate; isolated every red test.

**Artifacts:** this file and `review/review-iter-5.yaml`. No source, spec, test plan, pm-notes or decision
record was modified.
