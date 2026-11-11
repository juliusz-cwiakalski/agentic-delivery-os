# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-289
Date: 2026-11-11
Pause Required: no

Reviewed: `chg-GH-289-spec.md` **v1.4** (36 ACs, DEC-1..DEC-16, §15.1, §16.1, Appendices
A-D), `chg-GH-289-test-plan.md` **v1.3** (39 TCs, §1.2, §3.1-§3.3, §5.1, §5.2, §7.1,
§7.3 cell-ownership paragraph, §7.4, §8.3, §9 log, §10 notes), `chg-GH-289-plan.yaml`
**revision 2.1** (5 delivery phases), `chg-GH-289-pm-notes.yaml`, prior iterations 1 and 2,
`doc/decisions/TDR-0023-...md` (tracked, `Proposed`, `decision_date: null`, `## Revision`
present), and the delivered sources the W1 claim depends on.

Source evidence re-derived for this iteration (not taken from the artifacts):
`packages/cli/src/index.ts` (`parseInvocation` 241-291, `GLOBAL_FLAGS` 236,
`invocationFailure` 200-204, `outcomeFromResult` 209-234, `toErrorObject` 293-301,
`buildEnvelope` 303-327), `packages/cli/src/classify.ts` (`classifyThrown`, the
`kind === "fallback"` branch and its comment, `classifyDomainKind`),
`packages/cli/src/commands/dispatch.ts` (definition 114-155, `failure` helper → `kind:
"input"`), `packages/core/src/contracts/result.ts` (`CommandResultError` 36-43,
`CommandResultSuccess`/`Failure`), `packages/core/src/contracts/dispatch.ts`
(`DispatchEnvelopeError` 279-289), `packages/core/src/contracts/error-table.ts`
(`fallback.invocation` row, `domainKind: "fallback"`), `packages/core/src/contracts/state.ts`
(`StateStorePort.read` 332, `readRecords` 338), `tests/fixtures/dispatch/golden/harness.ts`
(`CommandScenarioOptions.store` as a wrapper function, `CommandRun` envelope type,
`createCommandScenario` 168-300), `tests/checks/privacy-release.test.ts`
(`validateChangeset`, the zero-changeset branch), `doc/spec/features/feature-result-contract.md`,
`doc/spec/features/feature-dispatch-engine.md:143`, plus one live invocation of the built
entrypoint to read a refusal envelope and a success envelope.

## Verdict in one line

Both iteration-2 blockers are genuinely discharged: W2 is gone (the privacy guard exits `0`
with zero violations over the whole tree, and its own suite is 39/39 green), and W1 is
discharged by a real suite cell — TC-ATTEMPT-034 cell 7 — in a new file that phase 2
declares, owns, and runs at its boundary, with the spec AC, F-9, §3.1, §5.1, §7.1, §7.3 and
the plan all naming the same cell map and no artifact any longer pinning the refusal on a
review; I separately verified the cell is *achievable* against the delivered parser,
`classifyThrown`, the error table and the fixture seam. N1, N2 and N3 are discharged; N4 is
persistent but inert. What remains is one systematic wording class — the artifacts describe
two envelope fields (`ok`, and an `error.kind`) that the delivered CLI result contract does
not carry — which fails loudly in the test files the delivery writes, cannot produce a false
green, and is recorded below as accepted residual risk with an exact remedy.

## Facet Summary
- spec_completeness: PASS (every M2-S12 clause still traced in Appendix A; the v1.4 edits add the refusal clause to AC-F9-1 rather than dropping anything; AC count stays 36)
- ac_quality: PASS (36 Given/When/Then criteria, no duplicate, no orphan, no AC renumbered; AC-F9-1's refusal clause is a real, suite-evidenced obligation — see R1 for its wording-to-assertion translation)
- plan_coverage: PASS (39/39 TCs and 36/36 ACs owned exactly once; 3+20+10+3+3 = 39 and 2+22+6+3+3 = 36 re-derived; cell split identical in plan, test plan and §7.3)
- test_traceability: PASS (36 §3.1 rows, 39 §5.1 rows, 39 §5.2 definitions, 39 §7.1 rows, sets identical; cell 7 exists with a real target file, a real seam and a stated expectation)
- cross_artifact_consistency: PASS (ticket → spec → test plan → plan align on the refusal cell, the `unresolvedIds` split, the constant reuse and the ownership arithmetic; residuals are R1-R3)
- decision_capture: PASS (DEC-1..DEC-16 in-spec, five graduated rulings in TDR-0023 with its revision section, OQ-1 deferred with its precondition; no new decision surfaced by the revisions)
- system_spec_consistency: PASS (B3's corrected statement survives in every artifact; the one contradiction I found is the envelope-wrapper description in R2, which no AC depends on and which the same artifacts forbid acting on)
- plan_doc_update_coverage: PASS (A8 discharged; §16.1's rows each owned by phase 4 or 5; 5.3's frontmatter rule and 5.4's test-spec list policy are consistent with the pages as they stand)
- plan_code_area_coverage: PASS (B1 discharged and unchanged; per-phase `scope.files` re-checked against every path the phase's work names, including the new `tests/behaviour/dispatch-additive-stability.test.ts` in phase 2)
- dod_defined: PASS (spec §4.1 metrics, §17 evidence classes, test-plan §10 log, per-phase evidence obligations)

Blocking findings: **0**. Non-blocking: 5 (3 minor, 2 nit). Persistent: 1 (R5).

## W1 — discharged, and the cell is achievable as designed

Iteration 2's W1 had four parts; each verified separately.

**1. The suite cell exists, with a real file.** TC-ATTEMPT-034 step 7 (test plan:1497) and
its Expected Outcome (test plan:1506) state the unknown-flag cell explicitly; §7.1 assigns
the case to `tests/behaviour/dispatch-additive-stability.test.ts` (test plan:1789) as
"To Implement". The file does not exist yet, which is correct — it is a new suite declared
in phase 2 `scope.files` (plan:898), named in phase 2's owning-TC obligation (plan:805-815),
and named by path in phase 2's `Done when` battery (plan:833). No artifact claims an
existing suite already covers it.

**2. Spec AC and F-9 cite it correctly, and nothing claims a review-only pin.**
`AC-F9-1` (spec:475) now carries the clause: with `acceptsAnyFlag` enabled, each of the four
delivered forms "exits `1` with `fallback.invocation` under that row's `kind: \"fallback\"`
and performs no store read (proven by a store seam that fails if read)", with the evidence
cell split "Suite for … the four delivered-form refusals … review-verified for the
additive-only half". F-9 (spec:138) names the guard as the only remaining refusal and says it
is "proven by the unknown-flag suite cell of the delivered-form stability case
(TC-ATTEMPT-034) rather than by that case's diff-review cell", keeping TC-ATTEMPT-039 as the
attempts-grammar owner. A grep of all four artifacts for the `cell 6` / `cell 7` labels
returns 26 matches (spec 0, test plan 10, plan 16) and every one of them either assigns the refusal to cell 7 or labels cell 6 as the
review-verified additive-only diff inspection and "NOT A GREEN CELL" (plan:815, plan:826,
plan:998, test plan:1513-1514, test plan:1818, test plan:1989). No artifact pins the
delivered refusal on a review or a diff.

**3. The cell map matches everywhere.** Phase 2 owns cells 1, 4, 5, 7; phase 3 owns cells
2-3; cell 6 is review-verified at the review gate. That split is stated identically in the
plan's TC-ownership block (plan:212-213), phase 2's obligations (plan:805-815), phase 2's
`Done when` (plan:825-828), phase 3's obligations (plan:998), TC-034's Notes
(test plan:1513), §7.3's cell-ownership paragraph (test plan:1818) and §1.2's evidence split
(test plan:49). Cell 6 never appears as a boundary-green cell.

**4. Satisfiability, verified against the code (this is what iteration 2 could not assert).**
- `acceptsAnyFlag` semantics: the parser's refusal is guarded by
  `if (!definition.acceptsAnyFlag && !allowedFlags.has(token))` (`index.ts:271-273`), so with
  the declaration the unknown-flag token is recorded as `flags[token] = true` and reaches the
  handler; globals (`--json`, `--verbose`, `--pretty`) are filtered out of the token list
  (`index.ts:236,251`) and `invocation.argv` carries the surviving tokens, so a handler guard
  can see `--bogus`. The three shapes the cell uses all fit the declared arity
  (`positionals: { max: 3 }`): `dispatch GH-301 --bogus` → 1 positional,
  `dispatch dual-run resolve DIV-1 --note n --bogus` → 3, `dispatch handover <repo> --bogus`
  → 2. `--repo` stays in `requiresValue`, so its value is consumed before the guard sees the
  unknown flag.
- Guard placement: the handler is entered only after parsing (`index.ts:360-386`), and every
  store access lives behind `runtime.*` (`commands/dispatch.ts:155-195`), so a guard at the
  top of the handler precedes all four surfaces' runtime calls; "zero store reads" is
  achievable for all four forms, including `dispatch <ref>`, whose store work is inside
  `runtime.run.run`.
- Identity and `kind`: the refusal must come back as the reserved fallback namespace. The
  local `failure()` helper emits `kind: "input"` (`commands/dispatch.ts:88-92`), and
  `classifyDomainKind("input", "fallback.invocation")` throws on the `domainKind` mismatch and
  is contained as `fallback.internal` (`classify.ts`, `classifyThrown`). The documented path
  is the one `classifyThrown` names in its comment — a handler returning
  `{ kind: "fallback", code: "fallback.invocation" }` — which resolves the
  `fallback.invocation` row (`domainKind: "fallback"`, `projectionClass: "user-validation"` →
  exit `1`). So the AC's `kind: "fallback"` clause is load-bearing as a *design constraint*
  on the guard, and cell 7's `error.code` assertion is what detects a violation: a guard-less
  or wrongly-classified guard yields data, a different code, or `fallback.internal`, and the
  cell reds at phase 2's boundary. See R1 for how the clause must be worded as an assertion.
- The seam is real: `CommandScenarioOptions.store` is a wrapper
  `(store: StateStorePort) => StateStorePort` applied at runtime construction, and
  `StateStorePort` exposes `read` (`state.ts:332`) and `readRecords` (`state.ts:338`), so
  "throw from `read`/`readRecords`" is expressible exactly as the plan (plan:701-704) and the
  test plan (test plan:1485) describe, and nothing in the delivered runtime reads eagerly at
  construction.

## W2 — discharged (verified by running it first)

- `bun run scripts/checks/privacy-literals.ts` → **exit 0**: "3578 file(s) scanned, 7 rule(s),
  0 distinct length(s), 0 violation(s)" on the pre-review tree, and "3579 file(s) … 0
  violation(s)" on a post-write re-scan that includes this record. Both classes report zero
  entries and both are documented as explicitly vacuous (mechanism-only, owner population out
  of band).
- `bun test tests/checks/privacy-literals.test.ts` → **39 pass, 0 fail** (284 expect calls),
  including `TC-PRIVACY-020` live-tree green, which failed at iteration 2.
- The two rewritten test-plan phrases are renamed, not hidden: §2 (test plan:65) now reads
  "host-root, home and checkout composition" and §6's fixture entry (test plan:1716) reads
  "host root, home and checkout facts". No home-root-shaped token remains, and the change
  folder (which the scanner covers — iteration 2's own violations were inside it) scans clean.
- The phase-2 battery that names this gate (plan:838-840) is therefore satisfiable from inside
  phase 2's declared scope; no file outside that scope is needed to make it green.

## N1-N4 — discharge evidence

- **N1 DISCHARGED.** `AC-F5-5` (spec:463) and `AC-F9-1` (spec:475) now state the split:
  `reported`, `resolved`, `unresolved` "keep their meanings as exact counts" while
  `unresolvedIds` "keeps its name, type, and order and narrows to the declared at-most-20 list
  with `idsTruncated`". Mirrors exist in §3.1 (test plan:99, :111), §3.2's `DM-3` and summary
  rows, §3.3's NFR-9 row, TC-ATTEMPT-022 step 9 / Expected Outcome (test plan:1057-1070),
  TC-028 step 4 (test plan:1283-1290) and TC-034 step 3 (test plan:1495). No artifact still
  says all four delivered block fields keep their *meanings*.
- **N2 DISCHARGED.** §22 (spec:510) now reads "the page and ledger bounds are declared
  constants beside the delivered dispatch bounds, while the byte and line budgets are the
  delivered dispatch constants themselves rather than second declarations, so each bound has
  exactly one declaration"; §16's contracts row (spec:399) states the same reuse. This matches
  plan work 1.2 (plan:530-540: five new names, three imported budgets) and the phase-1 summary
  (plan:645-650), and it keeps the export arithmetic at nine names for phase 1.
- **N3 DISCHARGED.** Work 1.1 (plan:512-522) now says the TDR "is already committed and
  indexed on this branch", that the item "VERIFIES presence and index and changes no content:
  no authoring, no re-commit, no amend", and keeps the record `Proposed` with
  `decision_date: null`. Verified: `git ls-files` lists both the record and
  `doc/decisions/00-index.md`, and the working tree is clean.
- **N4 PERSISTENT, non-blocking (R5).** `chg-GH-289-pm-notes.yaml:5-8` still shows
  `started: null` beside real completions for specification/test_planning/delivery_planning,
  and the archived note at :130-139 still says "Two declared deviations" (plan 2.1 declares
  the full TP1..TP7 → 1..5 mapping at plan:143-165). No superseding note was appended; no
  iteration-2 entry exists. `phase list GH-289` is authoritative and shows valid pairs, so
  this is reader-facing staleness only.

## Non-blocking findings (no facet fails on these; R1-R3 are accepted as residual risk)

R1. **[minor] test_traceability / ac_quality — test plan:281, :287, :326, :706, :820, :827, :1494, :1497, :1506; verified in `packages/core/src/contracts/result.ts:36-43` and by live invocation**
   Gap: the plan asserts two envelope fields the delivered CLI result contract does not carry.
   `error.kind` is asserted in TC-002 (step 2 and Expected Outcome), TC-003 step 2, TC-013
   step 2, TC-016 steps 2 and outcome, and the new TC-034 cell 7 ("…`error.code ===
   "fallback.invocation"` under `kind: \"fallback\"`"); `ok` is asserted in TC-002
   ("`ok: false`") and TC-034 step 4 ("exit `0` with `ok: true`"). The emitted error object is
   exactly `{code, category, retryable, consequence, remediationHint, summary?}`
   (`result.ts:36-43`, `index.ts:293-301`) and the envelope is
   `{schemaVersion, runId, exitCode, timing, data|error}` (`result.ts:49-64`); `DispatchEnvelopeError`
   adds only `detail` (`contracts/dispatch.ts:279-289`). `ok` exists in the MCP payload, not on
   the CLI envelope. A live refusal (`commit --bogus --json`) and a live success
   (`plan validate GH-289 --json`) confirm both shapes.
   Why it does not block: the identity assertions around them are correct and stronger — every
   affected cell also asserts `error.code`, the exit, and (for the new clauses) zero store
   reads — so no requirement is unpinned and no regression can ship green; the affected
   assertions live in test files the delivery writes fresh, so each fails immediately and
   locally at phase 2's own boundary, and the fix is to assert the emitted code (plus, where
   the row's classification matters, the runtime result's `kind`, which does exist, or the row
   read from `ERROR_TABLE`).
   Suggested remediation target phase: test_planning.
   Suggested fix: replace `error.kind` / `ok` with `error.code`-and-exit assertions, and word
   cell 7 as "each exits `1` on the `fallback.invocation` row (`projectionClass`
   `user-validation`) with zero store reads; the guard must return the reserved `fallback`
   namespace so `classifyThrown` resolves that row instead of containing it as
   `fallback.internal`".

R2. **[minor] cross_artifact_consistency / system_spec_consistency — spec:243 (§8.1 row), :280 (§8.5 envelope bullet), :473 (AC-F8-3), :560 (Appendix C item 3); test plan:125 (§3.2 DM-1 row)**
   Gap: the artifacts describe the machine envelope as `{ ok, command, data, error?, warnings? }`
   with `command: "dispatch"` / "`command` remains the family token", and AC-F8-3 requires the
   M2 page to "print `command: \"dispatch\"`". The delivered envelope carries none of `ok`,
   `command` or top-level `warnings` (see R1's evidence); `doc/spec/features/feature-dispatch-engine.md:143`
   and `doc/spec/features/feature-result-contract.md` describe the standard five-field
   envelope, and `command` exists only as an audit-ledger fact. The row is inherited from the
   M2 pack (`doc/planning/oss-tooling/milestones/m2/contracts.md:15`), which the spec's own
   authoring guideline (spec:588) undertakes to correct "where the delivered registry or engine
   contradicts it".
   Why it does not block: no acceptance criterion's substance depends on the wrapper — every
   substantive assertion is on `data` keys or `error.code` — and the same row forbids adding a
   top-level key, while F-9/AC-F9-1 forbid reshaping a delivered envelope; adding `ok`/`command`
   centrally would red the golden envelope suites. So the misdescription cannot change delivered
   behaviour; its only cost is that the phase-5 edit must not copy it.
   Suggested remediation target phase: specification (test plan row mirrors it).
   Suggested fix: "the standard `delivery.result.v1` envelope; `data` carries the `attempts.v1`
   keys of DM-1 and no new top-level key is added", delete the `ok`/`command` names from §8.5's
   envelope bullet, and restate Appendix C item 3 / AC-F8-3 as "the example shows the delivered
   envelope shape and the `data` keys of DM-1" (the family-token sentence may stay only if it is
   attributed to the audit record).

R3. **[minor] test_traceability — test plan:1497 (step 7) against :1506 (Expected Outcome); verified in `tests/fixtures/dispatch/golden/harness.ts` (`parseEnvelope`, `invoke`)**
   Gap: cell 7's four invocations omit `--json` (`dispatch GH-301 --bogus`, …) while the
   expectation asserts `error.code` and "prints that row's summary". The scenario's `invoke`
   only parses an envelope when stdout is JSON (`parseEnvelope`), and machine output is emitted
   only under `--json` (`index.ts:347`), so the envelope assertion is not executable as written
   for those four commands.
   Why it does not block: adding `--json` is a one-token change to the same cell, changes no
   behaviour, scope or AC, and the cell's substance (code, exit, never-entered store seam) is
   unaffected.
   Suggested remediation target phase: test_planning.
   Suggested fix: append `--json` to each of the four invocations in step 7 (or assert the code
   from the human diagnostic instead of the envelope, and say which).

R4. **[nit] plan_coverage / test_traceability — test plan:1481-1486 (preconditions), :1494 (step 4)**
   Gap: TC-034's preconditions name `createCommandScenario` and the admission harness but not
   the attempts harness, while step 4 ("run the attempts read") cannot be green under
   `createCommandScenario` alone: that fixture supplies no attempts port, so the branch answers
   `input.value.rejected`. The harness that does supply it (`attempts-harness.ts`, with the
   `invoke(argv)` of plan work 2.5) is declared in phase 2's scope (plan:755-760, :888).
   Why it does not block: the file, fixture and phase ownership are all declared, and the gap
   surfaces as an immediate red in the file being written.
   Suggested remediation target phase: test_planning.
   Suggested fix: add `tests/fixtures/dispatch/attempts-harness.ts` to the precondition list as
   cell 4's harness.

R5. **[nit] cross_artifact_consistency — `chg-GH-289-pm-notes.yaml:5-8, :130-139`; persistent from iteration 2 N4**
   Gap: the hand-maintained `phases:` mirror still shows `started: null` for three registered
   phases and the archived "Two declared deviations" note is stale relative to plan 2.1; no
   iteration-2 or iteration-3 note was appended.
   Why it does not block: phase state is registry-owned (`phase list GH-289` returns valid
   started/completed pairs and `evidence.class: verified`), the lint requires only the keys, and
   nothing in delivery reads the mirror as truth.
   Suggested remediation target phase: delivery_planning (append one superseding note; do not
   rewrite history).
   Suggested fix: one note recording that the registry pairs were verified via `phase list`, that
   plan 2.1 declares the full TP1..TP7 → plan 1..5 mapping, and that W1/W2/N1-N3 were discharged
   at spec v1.4 / test plan v1.3 / plan 2.1.

## Cross-checks requested for this iteration (including what the revisions could have broken)

- **AC totals and cross-references.** 36 AC ids in the spec, 36 distinct, 36 §3.1 rows with no
  duplicate. Appendix A is a clause-oriented matrix and names 32 of them; the four it does not
  name (`AC-F1-2`, `AC-F3-3`, `AC-F4-2`, `AC-F4-3`) are refusal/empty-history/fault criteria that
  hang off the read-side and taxonomy rows rather than off a distinct ticket clause, and each is
  still owned by a TC in §3.1. Every AC id quoted by the test plan and the plan exists in the
  spec, and no spec AC is missing from the test plan (set comparison). No stray "35"/"37"/"38"
  count claim survives outside the §25 history rows and the v1.0 test-plan log row, which are
  historical by design.
- **TC totals.** 39 ids in §5.1, 39 headings in §5.2, 39 rows in §7.1, identical sets. TC-036 →
  NFR-11, TC-037 → NFR-2 and TC-038 → AC-F5-5 remain the only non-AC-anchored cases, and each
  names its NFR/AC at §3.1/§7.1.
- **Cell numbering.** `1, 4, 5, 7` (phase 2) / `2-3` (phase 3) / `6` (review) is identical in
  plan:212-213, plan:805-815, plan:825-828, plan:998, TC-034 Notes (test plan:1513-1514), §7.3
  (test plan:1818), §1.2 (test plan:49), §7.1 (test plan:1789) and §10 (test plan:1989). The
  only cells named as green at a boundary are the ones a phase's surface can produce.
- **Ownership arithmetic.** Re-derived from the id lists, not the totals: phase 1 = 3
  (009, 010, 037); phase 2 = 20 (001-008, 011-017, 023-026, 039); phase 3 = 10 (018-022, 027,
  036, 038, 028, 034); phase 4 = 3 (029-031); phase 5 = 3 (032, 033, 035) → 39, every id once.
  ACs: 2 + 22 + 6 + 3 + 3 = 36, every criterion once, and the phase-2 AC list re-counted
  member by member.
- **Scope lists.** Every path a phase's work names is in that phase's `scope.files`
  (phase 1: 15 entries; phase 2: 19 including the stability suite; phase 3: 19 including the
  contract fixture and the isolation suite; phase 4: 6; phase 5: 15). Read-only references
  (the parser, the three fixtures A1 exempts, the regression batteries) are correctly excluded
  and the plan says why (plan:735-760).
- **TDR alignment.** TDR-0023's summary, D-5 and the two-folds row state the same three real
  movements as spec §8.5, and its `## Revision` records the B3 correction with status unchanged.
  Nothing in v1.4's refusal clause contradicts the record: the delivered forms' refusal is a
  preserved pre-existing behaviour, not a new ruling, and DEC-1's "no new row" is untouched.
- **Changeset and constants.** Work 5.7 (plan:1250-1260) declares one changeset with all five
  fixed-group packages at `minor`, no `testkit`, a non-empty body — exactly what
  `validateChangeset` requires (it rejects a `patch` entry), and the gate tolerates the current
  zero-added state, so it is green now and after phase 5. Constant reuse changes no package
  set, manifest or lockfile.
- **Help / parity / inventory split.** Unchanged from iteration 2 and still sound: phase 4 owns
  the usage line, the fifth entry, the coverage row, both entry-count pins and the help suites
  in one commit; phase 5 owns only page content and the two `doc/spec/**` scan targets for
  TC-017. Both pins are live at four today and green.
- **No artifact says "zero filesystem effects" or an upward count movement.** AC-F1-2's
  inherited-effects carve-out, §8.5, NFR-3, RSK-6, AC-F7-1 and TC-014/TC-022 all still agree.

## Mechanical gates re-run for this iteration

| Gate | Result |
|---|---|
| `bun run scripts/checks/privacy-literals.ts` (run first) | **exit 0** — 3578 files, 7 rules, 0 violations, both classes explicitly vacuous |
| `bun test tests/checks/privacy-literals.test.ts` | **39 pass, 0 fail** (iteration 2's one failure is gone) |
| `bun packages/cli/bin/delivery-os.ts plan validate GH-289` | `verdict=valid`, `artifact=yaml:chg-GH-289-plan.yaml`, `tier=full`, `readyForDevelopment=true` |
| `phase list GH-289` | four planning phases completed, every pair started-before-completed, `evidence.class=verified` (2817 records) |
| `bun test tests/structure/port-contract-inventory.test.ts` | **11 pass, 0 fail** (B1's gate live and green) |
| `bun test tests/checks/reference-page-parity.test.ts tests/structure/dispatch-help-inventory.test.ts` | **9 pass, 0 fail** (both pins live at four) |
| `bun test tests/checks/doc-conformance.test.ts tests/checks/dispatch-doc-conformance.test.ts` | **15 pass, 0 fail** |
| `bun test tests/structure/dispatch-composition.test.ts` | **24 pass, 0 fail** (A1's `["run"]` assertion holds) |
| `bun test tests/structure/subpaths.test.ts tests/structure/content-inventory.test.ts` | **10 pass, 0 fail** |
| `bun test tests/checks/help-guide-coverage.test.ts tests/checks/help-guide-coverage-mutants.test.ts tests/behaviour/dispatch-help-version.test.ts tests/golden/dispatch-summary.test.ts` | **9 pass, 0 fail** |
| `bun run scripts/checks/help-guide-coverage.ts` | all prompt-required commands covered, exit 0 |
| `bun run scripts/checks/forbidden-literals.ts` | **exit 0** |
| `bun test tests/checks/forbidden-literals.test.ts` | **27 pass, 0 fail** (iteration 2's two 5 s fixture-repo timeouts did not recur) |
| `bun test tests/checks/error-table-sync.test.ts tests/structure/dispatch-error-identity.test.ts tests/checks/exit-code-literals.test.ts tests/checks/privacy-release.test.ts tests/behaviour/dispatch-token-closure.test.ts` | **136 pass, 0 fail** |
| (evidence, not a gate) two live invocations of the built entrypoint: `commit --bogus --json` and `plan validate GH-289 --json` | refusal envelope = `{schemaVersion, runId, exitCode, timing, error{code,category,retryable,consequence,remediationHint,summary}}`; success envelope = the same five fields with `data` — no `ok`, no `command`, no top-level `warnings`, no `error.kind` |

Privacy note for this record: the scan was run first and this file describes the two former
violating phrases by their corrected wording only; it contains no home-root-shaped token and
no absolute user path.

## Residual risks I accept for this delivery

1. **`acceptsAnyFlag: true` widens the parser for the whole dispatch family.** Accepted: the
   observable contract now has a permanent suite pin (cell 7) with a throwing store seam, the
   guard's classification path is the documented `fallback` namespace, and the alternative (new
   error rows) is closed by DEC-1.
2. **`fallback.invocation` vs `input.value.rejected` at arity 4.** A second extra positional
   still freezes to the parser's `fallback.invocation`; accepted as a pre-existing global grammar
   class, made explicit by TC-003's note.
3. **Second divergence-ledger read on resolve.** Computing the block after the append re-reads the
   divergence ledger; NFR-2 bounds only the attempts read. Accepted, as plan 3.3 implies.
4. **Identifier narrowing.** On a root with more than 20 open divergences the summary's
   `unresolvedIds` and the human line return fewer identifiers, with no single-call path to the
   rest. Declared in §8.5, RSK-6, DEC-15 and pinned by TC-022/TC-028 cell 4; accepted as declared.
5. **Review-verified halves.** AC-F7-2's page half, AC-F8-3/4, AC-F9-1's additive-only half,
   AC-F9-2's diff half and AC-F4-1's side-effect enumeration rest on review with named checks and
   §10 rows; accepted as the strongest form available against a moving base.
6. **Cross-repository resolve stays disclosed, not prevented** (OQ-1, NG-7). Accepted; the result
   names the divergence's own repository.
7. **R1/R2/R3/R4 (new this iteration).** Accepted, on three conditions that make them
   non-silent: (a) each affected assertion fails immediately in a file the delivery is writing,
   at the boundary that owns it, so no false green is possible; (b) the authoritative identities
   (`error.code`, exit, `data` key sets, zero store reads) are already asserted beside them, so no
   requirement loses a pin; (c) the reviewer must confirm in phase 2 that the guard returns the
   reserved `fallback` namespace (not the local `failure()` helper, which would be contained as
   `fallback.internal`) and that no assertion was weakened while adapting to the emitted envelope,
   and in phase 5 that the read-side section of `doc/spec/features/feature-dispatch-engine.md`
   states the standard `delivery.result.v1` envelope rather than §8.1's row.

## Can delivery proceed?

Yes. Both iteration-2 blockers are discharged by evidence, not by promise: W2 is a reproduced
green scan plus a 39/39 suite, and W1 is a real suite cell in a real declared file, with a cell
map that is identical in all seven places that state it and an achievable design (verified
against the parser, `classifyThrown`, the error table and the fixture seam). Every mechanical gate
this review can run is green, `plan validate` accepts the plan at `tier=full`, and the four
planning phases are registered as completed.

The remaining defects are of a class that cannot cause a silent regression or leave a requirement
unpinned — they are assertions and one envelope description that must be aligned to the delivered
result contract while the affected files are being written. The override path is not used and is
not needed; this is a substantive change, and it is ready on its merits.

If the PM wants zero residual artifact risk before phase 2 rather than accepting R1-R3, the
cheapest route is a single touch-up pass over `specification` (§8.1 row, §8.5 bullet, AC-F8-3,
Appendix C item 3) and `test_planning` (six `error.kind`/`ok` sites, cell 7's `--json` and
wording, TC-034's attempts-harness precondition). That is an edit of roughly a dozen lines, needs
no new design work and no delivery-phase change, and would not alter this verdict's assessment of
the change's readiness.

VERDICT: READY
