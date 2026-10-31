# Code Review — GH-180 (M0-S11 db session-admin port) — Iteration 2

- **Status: PASS**
- **Directive: PROCEED**
- **Mode:** local (change review) · **Branch:** `feat/GH-180/db-session-admin-port`
- **Base:** `main-tools` @ `b31ec47` · **HEAD:** `67ff101` (pm-notes checkpoint; the docs/ADR commit was message-rewritten from `4e65628` to `41b450f` for F-3)
- **Artifacts:** spec v1.5 (18 ACs), test plan v1.4 (38 TCs), plan v1.3 (42 tasks + remediation row), evidence, `readiness-review/iter-1..3`, `ADR-0010`
- **Machine-readable:** `../code-review/review-iter-2.yaml`
- **Reviewer posture:** read-only. No source, test, or change artifact was modified. Only this review record and the YAML record were written.

---

## 1. Dimension verdicts

| Dimension | Verdict | Summary |
|---|---|---|
| **A. Spec / plan compliance** | **PASS** | Iteration-1 F-1 and F-4 are resolved. The prune re-read now parses the real nine-column projection (AC-D5..AC-D9 achievable on the real schema), and the contracts tier is data-only again with the pure policy injected from the CLI edge (AC-D16). 42/42 plan tasks are checked plus the remediation row; no open tasks. |
| **B. Code quality heuristics** | **PASS** | The re-read query and its projection parse are one guarded step with the correct pre-land (`db.query.failed`) vs post-land (`db.delete.failed`, normative partial summary) classification, `clamp`/clock reject non-finite values, and the policy is injected rather than duplicated. No new defect found by inspection or by re-running the suites. |
| **C. Evidence / CI verification** | **PASS*** | `pnpm check` reproduces **1759 pass / 2 skip / 0 fail**; `forbidden-literals`, `commitlint`, `error-table-sync` 35/35, `boundaries`, `doc-distribution`, and `privacy-literals` are green. 24/25 `scripts/checks/*.ts` pass; the only non-zero is `publish-guard`, which is release-only (`release.yml`, `workflow_dispatch`) and is not a PR gate (PR CI runs only its unit test). *One non-blocking evidence-completeness note (R-1): evidence §10 still records the intermediate `1758 pass / 1 fail` battery and never records the final green battery; the final numbers live only in pm-notes. |
| **D. Residual risks** | **PASS** | Activity-based liveness, checkpoint-only reboot, the external opencode surface, the C-11 owner merge gate, and `ADR-0010` (Proposed) are all recorded in the spec/evidence/AC-D18 and are **not** claimed accepted. They remain PR-body copy items (R-2/R-3/R-4). |

---

## 2. Remediation verification (iteration-1 findings)

#### F-1 (critical) — re-read projection — **RESOLVED**
- `RE_READ_SQL` now uses the shared `candidateSummarySql` projection (`packages/adapters/src/session/index.ts:437-465`), which projects `id, parent_id, time_created, time_updated, time_archived, has_children, message_count, part_count, data_bytes` — exactly what `readSessionRow` parses (`:300-330`).
- `readCandidate`/`classify` now run **inside** the guarded re-read block (`:563-574`). A pre-land failure returns the classifier error (`db.query.failed` / `db.opencode.unavailable`); a parse failure after a landed delete returns `abortAfterLand()` → `db.delete.failed` with the normative `"<failed> of <attempted> session deletes did not land (first: <id>); <landed> landed"` and `attempted = deleted + failed + 1` (`:552-558, :604-613`).
- Independently verified: the prune suite (26 tests) is green, including the new regression that feeds a projected row missing `time_created` (fails `db.query.failed`, zero deletes) and a post-land parse failure (returns `db.delete.failed` `"1 of 2 … (first: ses_cold_1); 1 landed"`).

#### F-5 (high) — fake masked F-1 — **RESOLVED**
- The fake now projects each re-read row down to the aliases in the issued SQL (`tests/fixtures/session-admin/harness.ts:38-70` `projectionAliases`/`projectSessionRow`, used by `queueProjectedQuery`), so a lost projection column fails the parse (`tests/behaviour/session-admin-prune.test.ts:79-89`).
- Regressions present at `tests/behaviour/session-admin-prune.test.ts:576-610` (missing required column, post-land parse failure). The re-read alias set is asserted at `:578-601`.

#### F-4 (high) — contracts tier — **RESOLVED (option b: inversion)**
- The pure-domain re-export block is gone from `packages/core/src/contracts/index.ts` (the file now ends the session-admin block at `:306-348` with data/constants/types only).
- The policy is injected from the composition root: `packages/cli/src/edge.ts:265-278` builds and passes it, and `packages/cli/src/commands/db.ts:8` imports `renderSessionAdminHuman` from `@delivery-os/core`. The adapter imports only `@delivery-os/core/contracts`.
- The structure test is non-vacuous: `tests/structure/session-admin-imports.test.ts:264-281` asserts zero `../domain/` refs in the barrel and plants a `../domain/session-admin.js` re-export that its detector must flag.
- The port-contract fixture no longer blesses the re-exports (`tests/fixtures/ports/v1-contract-inventory.json` removed `classifyPruneCandidate`, `computeDbCutoffMs`, `computeDbLiveBoundaryMs`, `isLiveDbSession`, `renderSessionAdminHuman`, `selectPruneCandidates`, `PruneCandidateDecision`, `PruneCandidateFact`).
- `check:boundaries` (120 modules / 232 deps), `workspace-entrypoints`, and `exports-parity` are green.

#### F-2 (high) — forbidden literals — **RESOLVED**
- `pnpm check:forbidden-literals` → exit 0, 5/5 scopes, 0 violations; the new doc is registered; the only remaining `ados` substring in the new doc/adapter-ports is the required `ados_distribution` frontmatter key.

#### F-3 (high) — commitlint — **RESOLVED**
- `pnpm exec commitlint --from origin/main-tools --to HEAD` → exit 0; no commit line exceeds 100 chars (independently scanned).

#### F-6 (medium) — `liveExcluded` — **RESOLVED (documentation option)**
- `liveExcluded` is documented as a defensive invariant in the adapter (`index.ts:510-512`) and the test states the fake bypasses SQL filtering (`session-admin-prune.test.ts:268-270`). This is the accepted documentation option; the field is not presented as a production non-zero count.

#### F-7 (low) — non-finite `clamp` — **RESOLVED**
- `clamp` and the injected clock guard `Number.isFinite` (`index.ts:284-292, :398, :505, :639`). The new direct-port test (`session-admin-prune.test.ts:634-671`) asserts `NaN`/`Infinity` inputs yield `db.query.failed` and issue **zero** SQL and zero deletes.

---

## 3. Findings (iteration 2)

No blocking or major findings. No regression was introduced by the remediation (adapter factory signature/injection, edge composition, test realism, and evidence were all inspected).

- **R-1 (info)** — `doc/changes/…/chg-GH-180-evidence.md:153` still records the intermediate remediation battery (`pnpm check` 1758 pass / 1 fail) and does not record the final green battery at HEAD. The final `1759 pass / 2 skip / 0 fail` is recorded only in `pm-notes.yaml:78`. Non-blocking (the claim is independently reproduced here); consider appending the final line to the evidence before the PR body is finalized.
- **R-2 (info, carry-forward F-8)** — The `db` command is not wired into a production entry point (`createDbCommandRuntime` is composed only from tests); this matches spec §4.4 (no bin entry) and must be stated in the PR body so it is not read as a delivered end-user command.
- **R-3 (info, carry-forward F-9 / AC-D18)** — Residual risks are surfaced and **not** claimed accepted: activity-based liveness, checkpoint-only reboot, the unverifiable external opencode surface, and the ADR-0003 C-11 owner merge gate; `ADR-0010` is `Proposed`. Copy all four statements into the PR body.
- **R-4 (info, carry-forward F-11)** — The non-CI real-store smoke still exercises only `size`/`list`, never `prune`/`reboot`; the plan's remediation retro already records this and recommends a dry-run prune. Note it in the PR body/evidence; not required for the PR gate.

---

## 4. Commands independently re-run (results)

| Command | Result |
|---|---|
| `bun test` over the 9 session-admin suites (contract, imports, size-list, prune, reboot, grammar, output, sql-safety, privacy) | **131 pass, 0 fail** (9 files) |
| `bun test tests/behaviour/session-admin-prune.test.ts` | **26 pass, 0 fail** |
| `bun test tests/structure/session-admin-imports.test.ts` | **17 pass, 0 fail** |
| `bun test port-contract-inventory, content-inventory, cli-edge-seam, error-table-sync, error-table, error-classification, config-default-positions` | **156 pass, 0 fail** |
| `pnpm check` (lint + format + typecheck + `bun test` + boundaries + exports-parity) | **exit 0** — **1759 pass / 2 skip / 0 fail**, 1761 tests, 158 files, 16126 expects |
| `pnpm run check:forbidden-literals` | **exit 0** — 5/5 scope classes, 0 violations; new doc registered |
| `pnpm exec commitlint --from origin/main-tools --to HEAD` | **exit 0** |
| `bun run scripts/checks/error-table-sync.ts` | **exit 0** — entries=35 documented=35 S1=51 S3=15 corpus=13 |
| `pnpm run check:boundaries` | **exit 0** — 120 modules, 232 deps; ambient 39, entrypoints, secret-read 102 files clean |
| `pnpm run check:privacy-literals` | **exit 0** — 1337 files, 0 violations |
| `bash scripts/.tests/test-doc-distribution.sh` | **exit 0** — 81 in-scope docs, no drift |
| 25 × `bun run scripts/checks/<name>.ts` | **24/25 exit 0**; `publish-guard` exit 1 (pre-freeze `private: true`) — **release-only** (`release.yml`, `workflow_dispatch`), not a PR gate; PR CI runs only `tests/checks/publish-guard.test.ts`, green in `pnpm check` |
| `git diff --check` | **exit 0** |
| `git status --porcelain` (after all runs) | **clean** — zero tracked changes |
| Targeted F-1 reproduction (projected-row regression) | **deletes succeed; missing-column → `db.query.failed` zero deletes; post-land parse → `db.delete.failed` with landed truth** |

Not re-run here (non-CI): the NFR-D4 latency measurement and the real-store smoke (both require a live opencode store).

---

## 5. AC / plan / TC reconciliation snapshot

- **ACs:** AC-D1..D18 supported. AC-D5..D9 now hold on the real re-read projection (F-1 fixed); AC-D16 holds (contracts data-only, non-vacuous structure test + boundary); AC-D17 holds (both previously failing CI gates green, `pnpm check` green).
- **Plan:** 42/42 tasks checked (0 open) plus the "Review iter-1 remediation | Complete" row; no `CHECKED_BUT_MISSING` or `DONE_BUT_UNCHECKED` gap detected for the remediation.
- **TCs:** 38/38 mapped and green; TC-DB-015..022 are now non-vacuous for the *real re-read projection* (F-5 regression), not only the decision logic.
- **Evidence:** re-run counts refreshed in evidence §10 and pm-notes; only the evidence's final-battery line is still intermediate (R-1).

---

## 6. Residual risk confirmation

All residual risks remain **surfaced and not claimed accepted**:
- Activity-based liveness (no PID/lock probe) — spec §3.4, RSK-D12, AC-D18(a).
- Checkpoint-only reboot (no process restart) — spec §3.5, AC-D18(b), `ADR-0010`.
- External opencode CLI surface unverifiable by repo tests — RSK-D5, AC-D18(c).
- ADR-0003 C-11 privacy sign-off / `ADR-0010` owner merge gate — `ADR-0010` status `Proposed`; no artifact claims approval; PR must be left open.

---

## 7. Directive

**PROCEED** — all iteration-1 blocking findings are resolved and independently reproduced. The only remaining items are non-blocking PR-body/evidence tasks (R-1..R-4). No source, test, or change artifact was modified by this review; only `review/review-iter-2.md` and `code-review/review-iter-2.yaml` were written.
