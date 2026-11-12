# Readiness review — GH-290 — iteration 4

- **Verdict:** READY
- **Date:** 2026-11-12
- **Gate:** `@readiness-reviewer` (adversarial Definition of Ready)
- **Artifacts reviewed:** `chg-GH-290-spec.md` (v1.4, 38 ACs), `chg-GH-290-test-plan.md` (v1.3, 45 TCs), `chg-GH-290-plan.yaml` (8 phases, `tier: full`), `chg-GH-290-pm-notes.yaml`, `readiness-review/readiness-iter-{1,2,3}.md`, `doc/decisions/TDR-0025-…` (amended in place, `status: Proposed`, untracked — `git status` `??`), and the delivered tree (`packages/cli/src/{help.ts,entrypoint.ts,help/prompt-required-commands.ts}`, `packages/core/src/{contracts,domain,app,state}`, `tests/behaviour/{daemon-mount-help,entrypoint-help}.test.ts`).
- **Plan validation:** `node_modules/.bin/delivery-os plan validate GH-290` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `node_modules/.bin/delivery-os lint plan GH-290` → `valid`, 0 errors.
- **Pause required:** no — no finding is blocking, no human decision is outstanding.
- **Scope of this iteration:** a narrow re-check of the two blocking findings (RF-14, RF-15) and the five advisories (A-18..A-23) routed by iteration 3, plus the declared regression sweep. Nothing else was re-litigated; iteration-3's "verified sound" set stands.

## Facet summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | PASS | Unchanged from iteration 3 (spec v1.4 edits are the two A-19/A-20/A-21 advisories; no AC, count, or scope statement moved) |
| ac_quality | PASS | 38 ACs (33 capability + 5 non-functional), unchanged and re-counted this round |
| plan_coverage | PASS | 8 phases cover every requirement and every AC; 45/45 TCs single-owner (re-derived below) |
| test_traceability | PASS | 38/38 ACs covered, 45/45 TCs indexed and automated, no TODO, five declared substitutes unchanged |
| cross_artifact_consistency | PASS | RF-14 and RF-15 closed; A-18, A-19, A-20, A-21, A-23 closed; the bound split now matches NFR-1, NFR-5, and the delivered help surfaces |
| decision_capture | PASS | TDR-0025 amendment/`Proposed`/untracked state unchanged; DEC-A..DEC-O unchanged |
| system_spec_consistency | PASS | The new test-plan bounds were measured against the delivered tree this round (root help, family-page precedent) and agree |
| plan_doc_update_coverage | PASS | A-21 closed: plan Phase 8 writes `doc/quality/test-specs`, lifecycle phase 7 verifies; §16 says the same |
| plan_code_area_coverage | PASS | A-22 closed: Phase 7 declares `packages/core/src/state/artifact-boundary.ts` |
| dod_defined | PASS | Unchanged: observable ACs, per-phase gates with named post-mount counts, Phase-8 done artifacts |

## Closure table — iteration-3 findings

Status vocabulary: **closed** = the artifact text now says the right thing and, where the finding was factual, the delivered tree agrees.

| ID | Status | Evidence checked |
|---|---|---|
| RF-14 | **closed** | `TC-EVT-011` step 6 (`test-plan.md:501`) now asserts only the machine envelope — `events list --json` ≤ 8 192 bytes compact, `--json --pretty` ≤ 65 536 bytes (`DAEMON_MAX_FRAME_BYTES`), **no line assertion** — and states explicitly that NFR-1 / AC-F2-2 bound the human page and are not re-applied to `--json`. Its Expected Outcome (`:505`) and §3.3's NFR-1 row (`:158`) carry the same split; `TC-EVT-080` step 3 (`:1496`) and the per-surface table (`:1188`) agree, as do spec NFR-1 (`:445`, human page only) and NFR-5 (`:449`, frame ≤ 65 536). No site applies a 40-line bound to pretty-printed machine output; the surviving 40-line assertions are the text pages (`:472`, `:531`), which is where NFR-1 scopes them. |
| RF-15 | **closed** | `TC-EVT-061` now carries a per-surface bound table (`:1181-1189`): root `--help` bounded **by content only** — nineteen rows, the delivered eighteen preserved in order as a subsequence, five section headers, ANSI-free, **no line or byte cap**; each `events` help page ≤ 120 lines / ≤ 4 000 bytes; the reference text page ≤ 40 lines / 8 192 bytes **owned elsewhere** (`TC-EVT-010/012/080`); the machine envelope by its own ceiling. Steps 1/6/7 (`:1192,1197,1198`), the Expected Outcome (`:1200-1203`) and `Related IDs` (`:1171`, "NFR-1 purity half only") agree. The cited precedent is real: `tests/behaviour/daemon-mount-help.test.ts:181-187` asserts `text.length ≤ 4_000` and `split("\n").length ≤ 120` for every `daemon` help entry. The premise is real: on this tree root `--help` renders **45 text lines / 1 747 bytes** with the eighteen rows (measured twice — `renderRootHelp(SYNTHETIC_BRAND)` and `runEntrypoint(["--help"])` with the same brand — 46 `split` elements including the trailing newline), and no delivered suite bounds root help (`entrypoint-help.test.ts` asserts containment only; the only size bounds in `tests/**` are the daemon pages and the reference-page constants). The Phase-5 gate can now go green. |
| A-18 | **closed** | The pinned token `EXTENSION PATH (S17 — not v1)` appears at every site the test plan scans or scopes: GAP-T6 (`:58`), the §2 reference-page row (`:73`), §3.5's S17 boundary row (`:191`), `TC-EVT-002` step 5 (`:315`), plus the version log (`:1812`). The scan range is the seven v1 sections, not a table subset: step 5 says the counts are asserted "over that whole range (the page prints them in `EXAMPLES`), not over a table subset", requires the excluded section present, non-empty, after `ERRORS` and before `SEE ALSO`, and step 6 (`:316`) adds a non-vacuity control (each of the seven sections resolved, a renamed heading fails). No "taxonomy tables only" scope survives in the test plan. |
| A-19 | **closed** | Spec §16 (`:547`) and DM-1 (`:415`) now declare the taxonomy module as the authored `as const` declaration **plus its one pure integrity validator** — the module's only executable export, with no clock, I/O, environment, or module-scope call expression; the "data-only, no executable export" wording is gone. That gives `TC-EVT-004`'s Phase-1 integrity half and `TC-EVT-063` step 3's "validator" inventory entry a declared production home, and plan Phase 1 declares `packages/core/src/contracts/taxonomy.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, and the `content-inventory` allowance row together. |
| A-20 | **closed (both halves)** | Spec §8.5 (`:437`) names all three omitted commands — `dispatch`, `coordinator`, `projects` — "fifteen of the eighteen delivered names"; `TC-EVT-061`'s target-layer note (`:1174`) names the same three. Verified against the tree: `PROMPT_REQUIRED_COMMANDS` holds exactly 18 names including those three (`packages/cli/src/help/prompt-required-commands.ts:11-30`), and `entrypoint-help.test.ts:29-45` holds the complementary 15. The conclusion (no edit required) is unchanged and correct. |
| A-21 | **closed (both halves)** | Spec §16 (`:577`) now says `doc/quality/test-specs/test-spec-resident-daemon.md` "is written by plan Phase 8 … and lifecycle phase 7 (`system_spec_update`) verifies and reconciles it rather than authoring it". Plan Phase 8 states the same ownership split and declares `doc/quality/test-specs` in `scope.folders`. The two artifacts now describe one split. |
| A-22 | **closed** | Plan Phase 7 `scope.files` now includes `packages/core/src/state/artifact-boundary.ts` (`plan.yaml:803`) alongside `state/registry.ts`, and the Phase-7 comment (`:744`) states the boundary read the shape may touch (`artifact-boundary.ts:108-112`), so a view-taking read on the boundary is inside the declared blast radius. |
| A-23 | **closed** | `AMB-T3b` is labelled `AC-F8-2's "a v1 peer"` (`test-plan.md:195`), matching AC-F8-2's current wording (`spec.md:652`, `test-plan.md:117`); the substitute body explains the delivered codec as the v1 peer implementation, and no "v0 peer" label survives (`grep` over all three artifacts). |

## Non-blocking observations (new, advisory only)

| ID | Severity | Facet | Finding | Reopen |
|---|---|---|---|---|
| N-1 | nit | cross_artifact_consistency | The two illustrative root-help measurements in `TC-EVT-061` (`:1185`, `:1197`) cite **1 677 bytes**; the same rendering path on this tree measures **1 747 bytes** (45 text lines is correct). Nothing depends on it — both sites say "record its measured size in the test output" and no assertion uses the number — but delivery must record the measured value and must not promote 1 677 into an asserted constant. | `test_planning`, only if the author wants the citation exact |
| N-2 | nit | cross_artifact_consistency | The plan's `SOURCES` block still cites "Spec … (v1.2 …)" and "Tests … (v1.2 …)" (`plan.yaml:7,33`); the current artifacts are spec v1.4 and test plan v1.3. Citation drift only — no content of either artifact changed in a way the plan contradicts. | `delivery_planning`, cosmetic |
| N-3 | nit | cross_artifact_consistency | Plan Phase 5's guard paragraph (`plan.yaml:593-599`) still describes `event-taxonomy-conformance.test.ts` as reading "the page's taxonomy tables (`0/0/4/3/3/3`)", while `TC-EVT-002` step 5 requires the counts over the whole v1 section range and explicitly "not over a table subset". The test plan governs and the plan's own item 4 (`:588-592`) already names the v1-section scan, so implementation must follow `TC-EVT-002` step 5 plus the step-6 non-vacuity control. | `delivery_planning`, cosmetic |

None of N-1..N-3 blocks delivery: each is a citation or wording residue that cannot make a Phase gate unachievable, and the binding text in every case is the corrected one.

## Regression sweep — re-derived this round

- **TC set.** 45 `#### TC-EVT-…` definitions, all unique; the index table and the §7 automation table each hold the same 45 ids (45 unique in each, identical sets); no plan-only or plan-extra id.
- **AC coverage.** 38 ACs in spec (33 capability = 5+5+7+3+3+2+4+4, plus 5 NFR), 38 coverage rows in the test plan, zero missing and zero extra, and every coverage row carries at least one `TC-EVT-…` witness.
- **45-TC single-owner plan map.** The eight map lines hold 45 distinct ids, each owned once: Phase 1 = 8 (001, 003, 005, 070-074), Phase 2 = 9 (004, 010-015, 051, 080), Phase 3 = 0, Phase 4 = 9 (023, 030, 040-042, 050, 075, 082, 083), Phase 5 = 5 (060-064), Phase 6 = 13 (002, 006, 016, 020-022, 024-027, 031, 032, 084), Phase 7 = 1 (081), Phase 8 = 0. The plan's id set equals the test plan's id set. The extra occurrences in the "suite halves proven before their owner" note (002, 004, 016, 031, 032) remain notes, not phase rows.
- **Plan gates.** `plan validate` → `valid`/`readyForDevelopment: true`; `lint plan` → `valid`, 0 errors. Phase 5's gate names `events-mount-help.test.ts`, which is in Phase 5 scope; Phase 7's gate names the tick-cost suite, also in scope.
- **No new contradiction from the v1.3/v1.4 edits.** The three edits that could have introduced one are the machine/human bound split (checked against NFR-1, NFR-5, TC-EVT-080, and the delivered renderer), the per-surface help table (checked against the delivered daemon precedent and a live render), and the taxonomy-validator/home statement (checked against DM-1, §16, Phase 1 scope, and the inventory step). All three are internally consistent and consistent with the tree. The A-20 and A-21 edits touch no AC, count, phase reference, or scope statement.

## Residual risks delivery accepts (named)

1. **The M2 page's prose is review-attested, not mechanically guarded.** The reference-record key set and the `Delivered (M2-S13)` status line remain Phase-5 page obligations with no token scan; GAP-T6, `TC-EVT-002` Notes, and the Phase-5 comment record that. Owner: `@doc-syncer` + `@reviewer` at lifecycle phases 7 and 8. Residual harm: a stale page can ship while every automated gate is green.
2. **Root `--help` has no size ceiling at all.** After RF-15 the root page is bounded by content only, so its growth is unchecked by any test; the case records the measured size (45 lines / 1 747 bytes today) as evidence. Accepted because the delivered tree never bounded it and inventing a bound would fail the page before `events` exists.
3. **The `events` help pages inherit the daemon family-page bound (≤ 120 lines / ≤ 4 000 bytes) rather than an AC-derived bound.** It is a delivered convention, witnessed at `daemon-mount-help.test.ts:181-187`, not a spec threshold; if a future `events` page legitimately exceeds it, that convention — not the AC — is what must move.
4. **The compact machine-envelope ceiling (≤ 8 192 bytes) is a test-plan derivation**, not a spec NFR threshold (NFR-5 gives 65 536). It is self-imposed and strictly tighter, so it cannot contradict NFR-5, but it is not AC-traced.
5. **`TDR-0025` stays `Proposed` and untracked** until Phase 8 stages it; the record is accepted or rejected with the PR review. Any process that snapshots the tree before Phase 8 sees no decision record on disk.
6. **Citation drift is carried, not repaired**, in the plan's `SOURCES` block (N-2) and its Phase-5 "taxonomy tables" phrasing (N-3). Delivery must implement `TC-EVT-002` step 5's range scan and the step-6 non-vacuity control, and must record the measured root-help size rather than the cited 1 677 bytes (N-1).

## Reopen routing

| Phase | Findings |
|---|---|
| `delivery` | none — this verdict releases delivery |
| `test_planning` | none blocking; N-1 is optional polish |
| `specification` | none |
| `delivery_planning` | none blocking; N-2 and N-3 are cosmetic |

No finding targets a phase gate. The Definition of Ready is met: spec, test plan, and plan now agree with each other, with the delivered tree, and with the system spec on every assertion this change depends on. Delivery may proceed.
