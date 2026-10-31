# Code Review — GH-180 (M0-S11 db session-admin port) — Iteration 1

- **Status: FAIL**
- **Directive: REMEDIATE**
- **Mode:** local (change review) · **Branch:** `feat/GH-180/db-session-admin-port`
- **Base:** `main-tools` @ `b31ec47` · **HEAD:** `4e65628` (docs/ADR commit)
- **Artifacts:** spec v1.5 (18 ACs), test plan v1.4 (38 TCs), plan v1.3 (42 tasks), evidence, `readiness-review/iter-1..3`, `ADR-0010`
- **Machine-readable:** `../code-review/review-iter-1.yaml`
- **Reviewer posture:** read-only. No source, test, or change artifact was modified. Only this review record and the YAML record were written.

---

## 1. Dimension verdicts

| Dimension | Verdict | Summary |
|---|---|---|
| **A. Spec / plan compliance** | **FAIL** | 42/42 plan tasks are checked and the command surface, bounds, defaults, error rows, store pin, `time_archived`, byte-exact `dataBytes`, and doc reconciliation are present, but the delivered `prune --apply` re-read does not parse the row the real query returns (see F-1). This breaks AC-D5..AC-D9 on the real schema. The contracts barrel also exports pure-domain behaviour, contradicting spec §4.2 / NFR-D9 / AC-D16 (F-4). |
| **B. Code quality heuristics** | **FAIL** | Correctness defect in the core mutation path (F-1); the same defect is masked by a fake that returns full rows (F-5). SQL discipline, id-shape validation, argv/no-shell execution, injected env/clock, no process kill, no sidecar deletion, no direct SQLite, and determinism otherwise look sound. |
| **C. Evidence verification** | **FAIL** | Focused suites and the error-table/contract/inventory/doc-distribution checks reproduce green (126 pass; 35/35; boundaries; 18 checks except `forbidden-literals`). But the phase-7 docs commit breaks two merge-blocking CI jobs: `ts-forbidden-literals` (F-2) and `ts-commitlint` (F-3). The evidence was recorded at phase 5 and does not re-verify phase 7. |
| **D. Residual risks** | **PASS** | Activity-based liveness, checkpoint-only reboot, external opencode surface, the C-11 owner merge gate, and ADR-0010 (Proposed) are all recorded in the spec/evidence/AC-D18 and are **not** claimed accepted. They must be copied verbatim into the PR body (F-9). |

---

## 2. Findings

### BLOCKER

#### F-1 (critical) — `db prune --apply` re-read parses a row the real query never returns: zero deletes, wrong identity
**Location:** `packages/adapters/src/session/index.ts:412-422` (`RE_READ_SQL`), `:519` (`readCandidate(reReadRows[0] ?? {})`), `:264-290` (`readSessionRow`)
**References:** AC-D5, AC-D6, AC-D7, AC-D8, AC-D9; TC-DB-015..TC-DB-022, TC-DB-037; plan task 3.2
**What:** `RE_READ_SQL` selects only `s.id`, `s.time_updated`, and `EXISTS(...) AS has_children`. The row is then passed to `readCandidate` → `readSessionRow`, which requires `row.time_created` (and `message_count`, `part_count`, `data_bytes`) via `asNumber`. Against the real `opencode db "<SQL>" --format json` those columns are absent, so `asNumber(undefined, "session.time_created")` throws. The throw is **outside** the inner re-read `try`, so it is caught by the outer `readPrune` catch and returned as `db.query.failed` (`field: session.time_created`) — before any delete runs.
**Reproduced** with a minimal-row fake (the real projection):
```
delete calls: []
result.ok: false
result: {"kind":"db","code":"db.query.failed","field":"session.time_created"}
```
**Impact:** On a real store `prune --apply` can never delete anything; AC-D5/D6/D7/D9 are unachievable, and a malformed re-read after a landed delete would be misclassified as `db.query.failed` instead of `db.delete.failed` with landed truth (AC-D8). The suite passes only because the fake returns a *full* session row for the re-read (`tests/behaviour/session-admin-prune.test.ts:72-82` → `store.ts:44-54`).
**Remediation (concrete):**
1. Include every column `readSessionRow` reads in `RE_READ_SQL` (`id, parent_id, time_created, time_updated, time_archived, has_children, message_count, part_count, data_bytes`), or build the re-check decision from a purpose-built minimal fact that does not require a full summary.
2. Move `readCandidate`/`classifyPruneCandidate` inside the guarded block so any parse failure maps to `db.delete.failed` (with the partial-abort summary) when `deleted + failed > 0`.
3. Add a regression test that feeds the **real projected** row (only the selected columns) to the re-read — see F-5.

#### F-2 (high) — Merge-blocking CI `ts-forbidden-literals` fails on the phase-7 docs
**Location:** `doc/spec/features/feature-session-database-admin.md` (new, unregistered), `doc/spec/features/feature-adapter-ports.md:30` (`ados`); registry `scripts/checks/forbidden-literals.registry.json:64`
**References:** NFR-D9/branding rule; AC-D17 (CI-clean); `.ai/rules/typescript.md §8`; CI job `ts-forbidden-literals` (`.github/workflows/ci.yml:503`)
**What:** `pnpm check:forbidden-literals` exits 1:
```
FAIL forbidden-literals: unregistered user-facing doc absent at corpusBaseline: doc/spec/features/feature-session-database-admin.md
FAIL forbidden-literals: doc/spec/features/feature-adapter-ports.md:30: ados
```
The new feature doc did not exist at `corpusBaseline` and is not in `registered`; the reconciled `feature-adapter-ports.md` (a registered doc that is scanned for seed literals) now contains the `ados` literal. The new doc itself contains `ados` on ~7 lines, so it will fail the literal scan as soon as it is registered.
**Remediation:** (a) register `doc/spec/features/feature-session-database-admin.md` in `forbidden-literals.registry.json` `registered`; (b) replace the `ados` seed literal in user-facing docs with brand-neutral wording (e.g., "the `db` command family" / "the CLI"), including the new doc and `feature-adapter-ports.md:30`; (c) re-run `pnpm check:forbidden-literals`. Note the DEC-8 allowlist is fixed at five ids, so adding an allowlist entry is a gate change and is not the intended path.

#### F-3 (high) — Merge-blocking CI `ts-commitlint` fails on HEAD `4e65628`
**Location:** commit `4e65628` (`docs(GH-180): reconcile system docs and record ADR-0010`), body/footer lines
**References:** CI job `ts-commitlint` (`.github/workflows/ci.yml:465`); dimension C
**What:** `pnpm exec commitlint --from origin/main-tools --to HEAD` exits 1 with two problems on `4e65628`: `body-max-line-length` (lines 211, 170, 146 chars) and `footer-max-line-length` (195 chars). Every other commit in the range passes.
**Remediation:** reword the commit body/footer so each line is ≤ 100 chars (short bullets / wrapped text), then re-run the same commitlint command. The "commit messages were rewritten for commitlint" premise holds for the delivery commits but not for the phase-7 docs commit.

### MAJOR

#### F-4 (high) — Pure domain behaviour is re-exported through the contracts tier
**Location:** `packages/core/src/contracts/index.ts:350-362`
**References:** spec §4.1, §4.2 ("No behaviour enters the contracts tier"); NFR-D9 ("contracts-tier behaviour: 0"); AC-D16 ("contracts remain data-only"); plan PIN-3/D5
**What:** The contracts barrel re-exports runtime functions `classifyPruneCandidate`, `computeDbCutoffMs`, `computeDbLiveBoundaryMs`, `isLiveDbSession`, `renderSessionAdminHuman`, `selectPruneCandidates` from `../domain/session-admin.js`. This creates a `contracts → domain` dependency (a tier inversion) and makes `@delivery-os/core/contracts` expose executable behaviour. The `session.ts`/`index.ts` data-only AST scans only cover `session.ts`, so no gate catches it; the port-contract inventory fixture was updated to bless the extra names.
**Why it happened:** the adapter is restricted to `@delivery-os/core/contracts` (cannot import core root or a domain subpath), so the shared predicate had to be surfaced somewhere. This is a real design tension, not a typo.
**Remediation (choose one, explicitly):** (a) amend spec §4.1/§4.2, NFR-D9, and ADR-0010 to record the deliberate contracts-barrel re-export as the shared-predicate access path, and extend the tier-purity check to assert the barrel's re-export allowlist (so the exception is tested, not silent); or (b) invert the dependency so no `contracts → domain` edge exists (e.g., add an explicitly governed pure-policy subpath with a matrix update + negative fixture, or have the CLI pass the predicate/selection into the adapter). Do not leave spec and code disagreeing.

#### F-5 (high) — Prune tests mask F-1: the fake returns a full row for the re-read
**Location:** `tests/behaviour/session-admin-prune.test.ts:72-82` (`queueReRead`), `tests/fixtures/session-admin/store.ts:44-54` (`sessionRow`)
**References:** TC-DB-015..TC-DB-022 (non-vacuity); AC-D5..AC-D9 DoD "asserted from a fixture"
**What:** `queueReRead` uses `sessionRow(...)`, which returns every column, including the ones `RE_READ_SQL` does not select. The suite therefore never exercises the adapter against the real re-read projection, which is exactly what hides F-1. Tests assert the SQL *text* contains the cold/live/leaf predicates but not that the adapter can parse the *projected* row.
**Remediation:** add a test (or change the re-read fixture) so the fake returns only `{ id, time_updated, has_children }` — the columns the re-read SQL selects — and assert the delete path still succeeds. This is the regression that would have caught F-1.

### MINOR

#### F-6 (medium) — `liveExcluded` is structurally always 0 in production; TC-DB-013 asserts an unreachable SQL response
**Location:** `packages/adapters/src/session/index.ts:402-410` (`SELECTION_SQL` filters `s.time_updated < liveBoundary`), `:460-467` (`liveExcluded` counted from returned rows); `tests/behaviour/session-admin-prune.test.ts:226-269`
**References:** spec §3.4/§3.6/§4.6; TC-DB-013
**What:** The selection query already excludes live rows, so the adapter never receives a live row to count; in production `liveExcluded` is always 0. TC-DB-013 reaches `liveExcluded = 4` only because the fake does not interpret SQL and returns live rows the real query would have filtered. The spec acknowledges liveness is a defensive invariant at the ≥ 1-day threshold, so this may be acceptable — but the reported field is then meaningless and the test is unrealistic.
**Remediation:** either compute `liveExcluded` with its own bounded count (and reconcile with "at most one selection query"), or document that `liveExcluded` is a defensive-invariant field (0 whenever the SQL predicate holds) and make the test state that the fake bypasses SQL filtering.

#### F-7 (low) — Defensive `clamp` does not reject non-finite values
**Location:** `packages/adapters/src/session/index.ts:255-256`
**References:** DEC-D8; NFR-D8
**What:** `clamp(NaN, …)` returns `NaN`, which would be interpolated into SQL as the literal `NaN`. The CLI handler rejects non-integers/out-of-range values, so this is unreachable through the command, but the "defence-in-depth clamp" does not defend against `NaN`/`Infinity` on a direct port call.
**Remediation:** guard `Number.isFinite(value)` in `clamp` (or at each call site) and return a classified failure rather than interpolating.

### INFO

- **F-8 (info)** — The `db` command is not wired into any production entry point: no production code calls `createOpencodeSessionIo`, and `createConfigProgram` is constructed only from tests. This matches spec §4.4 ("no bin entry, entry-point change"), but operators cannot invoke `adb db` from an installed binary until an embedder composes `DbComposition`. State this in the PR body so it is not read as a delivered end-user command.
- **F-9 (info)** — Residual risks are correctly surfaced and **not** claimed accepted: activity-based liveness (no PID/lock probe), checkpoint-only reboot (no process restart), the unverifiable external opencode surface, and the ADR-0003 C-11 owner merge gate; ADR-0010 is `Proposed`. Copy all four into the PR body (AC-D18).
- **F-10 (info)** — The working tree has one uncommitted change: `chg-GH-180-pm-notes.yaml` (`review_fix.started` timestamp). It is not part of HEAD; decide whether to commit or discard it before opening the PR. (Not modified by this review.)
- **F-11 (info)** — Evidence §5's real-store smoke exercised only `size`/`list`, never `prune`/`reboot`; that is why F-1 survived. Evidence also records `S1=50` while the current sync check reports `S1=51`. Prefer re-running the evidence battery after remediation.

---

## 3. Commands independently re-run (results)

| Command | Result |
|---|---|
| `bun test` over the 9 session-admin suites (contract, imports, size-list, prune, reboot, grammar, output, sql-safety, privacy) | **126 pass, 0 fail** (9 files) |
| `bun run scripts/checks/error-table-sync.ts` | **exit 0** — entries=35 documented=35 S1=51 S3=15 corpus=13 |
| `bun test tests/structure/port-contract-inventory.test.ts tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts tests/checks/config-default-positions.test.ts` | **131 pass, 0 fail** |
| `bun test tests/structure/content-inventory.test.ts tests/structure/cli-edge-seam.test.ts tests/checks/config-default-positions.test.ts` | **31 pass, 0 fail** |
| `pnpm run check:boundaries` | **exit 0** — 120 modules, 232 deps, no violations |
| 18 × `bun run scripts/checks/<name>.ts` (foundation, ignore, manifest, script-surface, entrypoints, tsconfig, changesets, testkit, ci-topology, ci-bindingness, ci-supply-chain, error-table, exit-code, secret-read, boundary-parity, privacy, ambient, forbidden) | **17/18 exit 0; `forbidden-literals` exit 1** (F-2) |
| `bash scripts/.tests/test-doc-distribution.sh` | **exit 0** — 81 in-scope docs, no drift |
| `git diff --check` | **exit 0** |
| `git diff b31ec47..HEAD --name-only \| grep '^(tmp/\|\.ai/local/)'` | **none committed** |
| `pnpm exec commitlint --from origin/main-tools --to HEAD` | **exit 1** — `4e65628`: body-max-line-length + footer-max-line-length (F-3) |
| Targeted reproduction of F-1 (minimal re-read row) | **`db.query.failed` (`session.time_created`), zero deletes** |

Not re-run here (deferred to the quality-gates phase): full `pnpm check` (1754 pass / 2 pre-existing skips), the NFR-D4 reference latency measurement (non-CI), and the real-store smoke (non-CI).

---

## 4. AC / plan / TC reconciliation snapshot

- **ACs:** AC-D1..D4, D10..D18 supported by code + suites; **AC-D5..D9 not met on the real schema** (F-1). AC-D16 partially unmet by intent (F-4). AC-D17 fails at the CI level (F-2, F-3).
- **Plan:** 42/42 tasks checked, but task 3.2 (per-candidate re-read) is incompletely implemented, and task 5.7's "full battery green" was not re-verified after phase 7.
- **TCs:** 38/38 mapped and green in the fake-driven suites; TC-DB-015..022 are non-vacuous for the *decision* logic but not for the *real re-read projection* (F-5).

---

## 5. Directive

**REMEDIATE** — fix F-1 (and the F-5 regression), restore `forbidden-literals` (F-2) and `commitlint` (F-3), and resolve F-4 explicitly (code change or governed spec amendment). Re-run the focused suites + the two failing CI gates + `pnpm check`, re-record evidence for the phase-7 tree, then request review iteration 2.
