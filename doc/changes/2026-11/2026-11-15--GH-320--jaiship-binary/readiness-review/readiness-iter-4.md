# Readiness Review Iteration 4

Verdict: READY
Work Item: GH-320
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-320-spec.md` (v1.5), `chg-GH-320-test-plan.md`
(v1.4, 55 cases), `chg-GH-320-plan.yaml` (revision 1.3, 5 phases, 44 declared
files + 2 folders, `plan validate` = valid / tier full), `chg-GH-320-pm-notes.yaml`
(D1–D13, D5 withdrawn), `readiness-review/readiness-iter-{1,2,3}.md`, and the
current delivered tree (`packages/cli/src/{entrypoint,production,edge}.ts`,
`packages/cli/bin/delivery-os.ts`, `packages/core/src/branding/index.ts`,
`scripts/install.sh`, `scripts/checks/forbidden-literals.ts` + registry,
`scripts/.tests/test-doc-distribution.sh`, and the delivered suites the
artifacts cite).

Iteration 3's blocking finding is genuinely closed: the seed-cleanliness
assertion is now the delivered per-line, line-allowlisted form, and it is
attainable, live, and non-vacuous. The invalid-override remediation is
cross-artifact consistent (spec §8.5 / AC-F2-7 / D13 / plan binding block /
plan 2.6 / TC-BIN-012) and matches the delivered tree, which I re-measured this
iteration. The plan-side minors are all present and numerically correct. What
remains is one cross-artifact precision gap about *notice rendering* on the
containment path and a set of minors/nits — none of them prevents delivery from
starting, and each has a cheap in-delivery resolution stated below.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 0. Major (non-blocking): 1. Minor: 4. Nits: 4.

## Verification performed (reproducible; hermetic)

Every probe used a scratch `HOME` (`/tmp/opencode/dor4-home`) and a fixture
checkout (`/tmp/opencode/dor4-fixture`) under `/tmp/opencode`. No daemon was
started, no probe read or wrote the operator's real `~/.delivery-os-state`, no
artifact was edited, and no mutating git command was run (only read-only
`git log`/`git show` for revision archaeology).

**Iteration-3 finding 1 (blocking, `TC-BIN-072`).** The new assertion form is
attainable and the control is live, verified against the delivered module and
scan:

- A compliant guide (`ados_distribution: redistributable` + otherwise seed-free
  body + identity header) in a scratch git tree with the delivered registry and
  scanner → `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`.
- The per-line check (skip `ados_distribution:`/`source:`/`Copyright`/
  `Apache-2.0`, then `matchSeedLiteral(line) === undefined`) over that guide →
  **0** violations. The bare whole-text matcher over the same guide → `ados`,
  i.e. the removed assertion was indeed unattainable and its prohibition is
  correct.
- Negative control, one seed at a time spliced into a **body** line:
  `ados` → `FAIL … doc/guides/local-install.md:11: ados` (exit 1),
  `ADOS_` → `…:11: ADOS_`, `~/.ados` → `…:11: ~/.ados`. Token **and** line are
  reported, so step 7's "the per-line check must report it too" is implementable
  with the same data.
- Registry semantics confirm the case's precondition: `scanFile` is per line and
  `isHeaderLine` allowlists exactly `Copyright`, `source:`, `Apache-2.0`,
  `ados_distribution:`; `scan` scans only `registry.registered` for `doc/**`;
  an unregistered new doc absent at `corpusBaseline` fails closed naming the
  path (step 8's control is live). Repo scan re-run green: 5/5 classes, 382
  package files, 9+2+1 root files, 157 user-facing docs, 0 violations.
- Plan obligation 4.3(d) mirrors the same form and forbids reintroducing the
  bare equality; the phase-4 gate note states the same. No remaining
  unattainable assertion exists in `TC-BIN-072` steps 1–10.

**Iteration-3 finding 2 (major, `TC-BIN-012`).** The remediation matches the
delivered tree; nothing in the four artifacts requires a behaviour change:

- `HOME=<scratch> DELIVERY_OS_WORKING_NAME='bad/name' … status --json` →
  exit `2`, stderr `delivery-os: fallback.internal` /
  `summary: command "status" is not part of the composed prompt-required set`,
  envelope `error.code = fallback.internal`, `error.summary` the same sentence,
  no `warnings` field. The pre-composition touch is real: the run creates
  `<scratch>/.delivery-os-state` and writes `host-index.json`. So step 5's "do
  not assert zero reads/state" is correct and step 6's "touch unchanged" is a
  truthful equality target.
- `… daemon status --json` as **two** argv tokens → exit `1`,
  `fallback.invocation`, `unexpected argument "status"`, nothing left running.
  The note's delivered secondary fact is exact.
- Self-description with the invalid override equals self-description with no
  override for the alias (`delivery-os 0.0.0 (build dev)`, exit 0), matching
  step 7.
- Cross-artifact agreement re-read: spec §8.5 (line 323) makes the touch part of
  "behaviourally unchanged" and states no zero-read requirement; AC-F2-7 (519)
  splits positional-free vs subcommand-bearing and requires the touch "left
  exactly as delivered"; D13 records the same; plan's binding block (312+),
  obligation 2.6 (617–636) and the phase-2 escalation trigger all agree; every
  "zero reads / zero state / composition never runs" phrase is gone from the
  case, the note, §8.2, §8.3, the plan and the spec's operative sections.

**Iteration-3 minors 3–7, mechanically re-checked.**

- `TC-BIN-070` step 2 quotes the delivered full sentence
  `The bin is not part of the install or release surface.` — verified present at
  `doc/spec/features/feature-cli-entrypoint.md:99`, and plan 4.6 requires the
  same full-sentence form.
- `TC-BIN-071` step 5 requires **all four** spec pages, keeps `doc/00-index.md`
  untouched and replaces the index argument with the M4-S1 deferral; plan R-D
  and the phase-4 discoverability note agree.
- `--filter`: **0** occurrences in test plan v1.4, **0** in plan r1.3, 82
  `-t "<pattern>"` selections; the case bodies and the §7 table agree
  (`-t "divergences"`, `-t "invalid-override"`).
- Census: 21 `runEntrypoint(` sites in 17 delivered test files (counted);
  three floor-dependent suites plus `tests/structure/entrypoint-bin.test.ts`
  (edited in phase 1 for unrelated obligations, 13 files neither edited nor
  changed at their call sites) — the plan's corrected classification matches the
  tree, including `tests/structure/cli-edge-seam.test.ts:302`
  (`configuredWorkingName: "synthetic"`).
- Installer help split: `scripts/install.sh` header names all five
  (`:37–42`); rendered `--help` Environment section names four
  (`ADOS_HOME`, `ADOS_REPO_DIR`, `ADOS_SOURCE_DIR`, `ADOS_REPO_URL`) and prints
  the fifth's expanded value in the one-liners (`scripts/install.sh:172,1055`).
  Exact — with one wording imprecision recorded as finding 3.
- Citations: plan cites spec v1.5 / test plan v1.4; test plan front matter cites
  spec v1.5; spec revision log has 1.5 and test plan 1.4. Two per-case leftovers
  remain (finding 6).
- Arithmetic: spec §16 file impact map = 44 files + 1 fixture folder
  (`tests/fixtures/entrypoint/prior-identity/`) + 11 UNCHANGED rows; plan scope =
  44 files + 2 folders (fixture folder + change-folder staging). Set-equal, 0
  plan-only, 0 spec-only. Phase distribution 14+12+4+11+3 = 44, one phase per
  file. `delivery-os plan validate GH-320` → `valid`, `tier=full`,
  `readyForDevelopment=true`.
- Trace: 55 unique `TC-BIN-*` case headers, 55 ids in the plan's TC→PHASE map,
  set-equal (13+26+8+4+4); 11 AC rows, 15 DEC rows; `TC-BIN-083`/`084` traced.

## Iteration-3 finding dispositions

| # | Iter-3 severity | Disposition | Basis |
|---|---|---|---|
| 1 | blocking (critical) — `TC-BIN-072` step 7 bare matcher | **Closed** | Attainable, live, non-vacuous (probes above). Steps 7–9, Expected Outcome, R-TP-15, §3.5, §8.2, plan 4.3(d) and the phase-4 gate note all carry the delivered per-line form and forbid the bare equality. |
| 2 | major — `TC-BIN-012` zero-read/no-state clause | **Closed on the test-plan and plan sides; residual spec wording is finding 4** | Step 5 now asserts only no substituted identity and no notice; step 6 asserts the touch unchanged as an equality against a control; spec §8.5/AC-F2-7/D13 and plan 2.6/binding block agree; delivered probe confirms the touch and the two projections. |
| 3 | minor — `TC-BIN-070` stale phrase | **Closed** | Delivered full sentence quoted and checked in full; present today at line 99. |
| 4 | minor — `TC-BIN-071` all four pages | **Closed** | Step 5 requires all four, index untouched, deferral rationale; plan R-D mirrors. |
| 5 | minor — `--filter` | **Closed** | 0 occurrences in both artifacts; harness entries use `-t`. |
| 6 | minor — census classification | **Closed** | 21/17 census re-counted; the `entrypoint-bin.test.ts` exception is named and phase-1-owned. |
| 7 | minor — installer-help wording | **Closed with residual (finding 3)** | Header/help split is now exact; only the equality operand is imprecise. |
| 8 (nit) — AC-F2-7 universal quantifier | — | **Improved to acceptable** | The parenthetical names the subcommand-bearing projection; the plan and the case state the per-shape rule. Residual is a phrasing nit only. |
| 9 (nit) — PM retro overstates closure | — | **Persistent (nit 9)** | `pm-notes` retro rows are unchanged; D12/D13 were added and do not claim otherwise. |

## Findings

### Major (non-blocking)

1. [major] cross_artifact_consistency / test_traceability —
   `chg-GH-320-test-plan.md` `TC-BIN-012` step 5 (line 494), its Expected
   Outcome (line 501) and the §3.1 `AC-F2-7` row; `chg-GH-320-plan.yaml`
   obligation 2.6 (lines 635–636); `chg-GH-320-spec.md` AC-F5-6 (line 518) and
   §10.
   Gap: step 5 asserts "no `prior-identity-fallback` notice is emitted … (the
   run never reaches the prior-identity fallback in this state)" for the
   invalid-override run, and the case's own precondition supplies
   `.delivery-os/config.yaml` "so a fallback *would* be possible". For the
   `jaiship` bin that precondition forces a prior configuration fallback during
   the delivered pre-composition acquisition (the work that reads
   `.delivery-os/config.yaml` and registers the host root — measured again this
   iteration), so "never reaches the prior-identity fallback" is factually
   wrong for `jaiship`; only the alias, which declares no prior identity,
   satisfies the rationale. AC-F5-6 ("**Given** a fallback read, **when** any
   command runs in any mode including `--json`, **then** exactly one notice …
   is written to stderr") has no containment-path carve-out, so an
   implementation that renders the notice immediately would be spec-compliant
   and would fail step 5, while an implementation following "the delivered
   warning channel" passes it — I verified the delivered channel is **not**
   rendered on the containment path (a state root with
   `ledger.default.jsonl` yields the delivered store warning on a valid run and
   no warning at all on the invalid-override run, while the host-index
   maintenance still writes). Two implementations are therefore admissible and
   only one satisfies the case as written.
   Suggested remediation target phase: test_planning (preferred) or
   specification if the carve-out is stated there.
   Suggested fix: scope the notice clause to the alias, and for `jaiship` either
   assert the `config-read` notice on the next successful composed invocation
   rather than on the containment run, or state that the containment path does
   not render notices (with the same sentence added to §8.5/§10). Keep the
   "no prior-identity identity substituted" half for both bins, and replace
   "never reaches the prior-identity fallback" with "reaches it only as the
   pre-composition read, before containment". Mirror in plan 2.6.

### Minor

2. [minor] test_traceability — `chg-GH-320-test-plan.md` `TC-BIN-012` step 6
   (line 495), its precondition (line 487), §3.5 `BYTE-TP-1` (line 174) and
   `chg-GH-320-spec.md` §16 (line 495); `chg-GH-320-plan.yaml` 2.6 (629–630)
   and the phase-1 BYTE-TP-1 "first act" (453–461).
   Gap: step 6 asserts the touch "unchanged against the recorded pre-change
   control", but no artifact or capture command records that control.
   `alias-baseline.json` is specified to carry version, help, paths and the
   invalid-override projection only, and the phase-1 capture command collects
   the same three runs. The equality is also literally alias-only (the `jaiship`
   bin has no pre-change run, and its state root would be `.jaiship-state`), so
   a path-level equality cannot pass for `jaiship`.
   Suggested remediation target phase: test_planning (with delivery_planning for
   the capture step).
   Suggested fix: extend the BYTE-TP-1 capture (and the fixture's documented
   fields) to record the touch — configuration read count and the created
   root/host-index presence — or state that the control is recorded in-suite
   from HEAD before any edit; phrase the `jaiship` half as shape equality, not
   path equality.

3. [minor] test_traceability — `chg-GH-320-test-plan.md` `TC-BIN-072` step 9
   (line 1585).
   Gap: it says to "assert the one-liner URL equals the raw-URL default value".
   The rendered one-liner is the default plus a suffix:
   `https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install.sh`
   (`scripts/install.sh:1055` over the default at `:172`), so an equality
   assertion fails; only a prefix/append comparison is attainable.
   Suggested remediation target phase: test_planning
   Suggested fix: assert the one-liner URL equals the `ADOS_RAW_URL` default
   plus `/scripts/install.sh` (or `startsWith` the default). The header/help
   split in the rest of step 9 is exact and verified.

4. [minor] system_spec_consistency / spec_completeness — `chg-GH-320-spec.md`
   §2.1 (line 71).
   Gap: "An invalid override or name falls back to the neutral default **for
   self-description only**" is the sentence iteration 3 cited under finding 2;
   the remediation added the touch to §8.5 and AC-F2-7 but left §2.1. The
   delivered probe shows the lenient fallback also feeds the pre-composition
   composition work (config reads, state-root registration), so "for
   self-description only" overstates the scope even as a snapshot of delivered
   behaviour. It does not assert zero reads and §8.5/AC-F2-7/D13/plan binding are
   the operative contracts, so nothing is contradictory — but a phase-8 reader
   can still read it as a constraint on the composition.
   Suggested remediation target phase: specification
   Suggested fix: state that the lenient fallback is what keeps
   `--version`/`--help` usable and that the configuration-bearing command keeps
   only the containment projection *plus* the unchanged pre-composition touch
   (§8.5).

5. [minor] plan_coverage / test_traceability — `chg-GH-320-plan.yaml` 4.3(b)
   (lines 817–826) vs `chg-GH-320-test-plan.md` `TC-BIN-071` step 4 (line 1552)
   and `TC-BIN-072` step 6 (1582).
   Gap: 4.3(b) requires the guide to cover the `--print-install-path` read and
   the optional operator one-step move (§19, not automated); neither case's
   content enumeration asserts them, so two declared guide obligations have no
   verification.
   Suggested remediation target phase: test_planning (or delivery_planning)
   Suggested fix: add both items to `TC-BIN-071` step 4, or drop them from
   4.3(b) and state where they are proven.

### Nits

6. [nit] cross_artifact_consistency — `chg-GH-320-test-plan.md` `TC-BIN-012`
   Objective (line 473) and `TC-BIN-072` Objective (line 1561) still say "as
   spec v1.4 pins them" while both cases bind v1.5; the §2 references row
   (line 71) says the plan is "revision 1.x (1.1 at this writing)" and the §8.3
   row (line 1898) says the plan reference "is revision 1.1", while r1.3 is
   binding. Suggested remediation target phase: test_planning.

7. [nit] test_traceability — `chg-GH-320-test-plan.md` `TC-BIN-070` step 2
   (line 1524) lists "any statement that `status` acquires no project
   configuration" as a stale phrase present today, but no such statement exists
   on the five declared pages (searched `doc/spec/features` for `acquire` /
   `project configuration`). Per-page non-vacuity rests on the other stale
   phrases, so the row is not empty — but the phantom phrase should be replaced
   with the actual pre-change sentence or dropped. Suggested remediation target
   phase: test_planning.

8. [nit] test_traceability — `TC-BIN-072` step 7(a) and step 8 assert the same
   "registered + repo-wide scan green" facts with different controls (body-line
   splice vs registry removal). Harmless duplication, but two steps can drift.
   Suggested remediation target phase: test_planning.

9. [nit] precision — "no fallback identity is substituted" (AC-F2-7,
   `TC-BIN-012` step 5, §3.1) means "no *prior*-identity identity"; the lenient
   fallback to the invoking bin's declared default is itself a substitution by
   construction. The parentheticals disambiguate today; "no prior-identity
   identity is substituted" would remove the ambiguity. Suggested remediation
   target phase: specification and test_planning (same wording change).
   Persistent nit from iteration 3: the `pm-notes` iteration-2 retro still reads
   "Minors fixed in plan r1.2"; only PM-record hygiene.

## Notes (verified, no action)

- Ticket fidelity is unchanged from iteration 3: OPEN, milestone
  `M4: Public release readiness`, six ACs; AC4's `status --json` surface is kept
  with DEC-14's disclosed deviation; GH-310 is the stop-open constraint and the
  plan's PR target is `main-tools`.
- The plan's scope, phase ownership and gate commands still resolve to existing
  files (`changesets-group.ts`, `exports-parity.ts`, `forbidden-literals.ts`,
  `prompt-conformance.ts`, `help-guide-coverage.ts`,
  `test-doc-distribution.sh`, `test-install.sh`, `lint-commit-range.sh`,
  `node_modules/.bin/delivery-os`), and no gate in either artifact contains the
  retired name-filter flag.
- `tests/checks/doc-conformance.test.ts` and
  `tests/checks/forbidden-literals.test.ts` exist (extension/re-run targets);
  `tests/checks/identity-docs.test.ts` and `tests/structure/install-launcher.test.ts`
  are correctly NEW.
- The guide's seed-cleanliness requirement does not collide with its mandatory
  licence header: the header lines are `Copyright` / `Apache-2.0` / `source:`
  and the generated URL contains no seed token; the marker line is allowlisted
  by the delivered scanner.
- D12 (cap extension) and D13 (delivered pre-composition touch) are recorded in
  `pm-notes`; this verdict is the fourth iteration and no human input is
  requested.
- Environment hygiene: the probes created only `/tmp/opencode/dor4-*`; the
  operator's real state root was not touched, no daemon was started, and the
  worktree is clean.

## Residual risk

- The single substantive residual is finding 1: if phase 2 renders the new
  notice on the containment path (a reading AC-F5-6 permits), the `jaiship` cell
  of `TC-BIN-012` step 5 fails. The natural implementation — surfacing the
  notice through the delivered warning channel, which I verified is suppressed
  on that path — passes, so this is a precision gap rather than an
  unattainable assertion. Resolving it by narrowing one sentence is the cheap
  and correct remedy; suppressing the notice to make the case pass would
  violate AC-F5-6 and must be rejected at review.
- Findings 2–5 are mechanical wording/citation repairs that can be made during
  the owning phase without reopening scope. None of them invalidates a declared
  phase, obligation, AC, or the blast radius.

## Next

No reopen required for the gate: `dor_check` may complete and delivery may
start. Apply finding 1 (and, while in the file, findings 2–5) during
`test_planning`/`delivery_planning` as a recorded reconciliation, and mirror the
resolution in plan 2.6. A fifth readiness iteration is not warranted: the
remediation trend is convergent (5 → 1 → 1 → 0 blocking) and every remaining
item is a precision fix with a stated target.
