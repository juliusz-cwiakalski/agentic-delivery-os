# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-320
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-320-spec.md` (v1.4), `chg-GH-320-test-plan.md`
(v1.3, 55 cases), `chg-GH-320-plan.yaml` (revision 1.2, 5 phases, 44 declared
files + 2 folders, `plan validate` = valid / tier full), `chg-GH-320-pm-notes.yaml`
(D1–D11, D5 withdrawn), `readiness-review/readiness-iter-1.md`,
`readiness-review/readiness-iter-2.md`, GitHub issue 320 (re-read this iteration:
OPEN, milestone `M4: Public release readiness`, six ACs), and the current tree
(`packages/cli/src/{entrypoint,production,edge}.ts`,
`packages/core/src/branding/index.ts`, `packages/mcp/src/serve.ts`,
`scripts/install.sh`, `scripts/.tests/test-doc-distribution.sh`,
`scripts/checks/forbidden-literals.ts` + registry, and the delivered suites the
artifacts cite).

The iteration-2 *substance* is largely real: the invalid-override projection is
now stated per invocation shape and matches the delivered tree, the guide's
fourth divergence is a coherent by-role rule, and every plan-side minor from
iteration 2 is present. But the two iteration-2 findings are not both genuinely
closed: the guide remediation added an assertion that cannot pass on a compliant
guide, and the invalid-override case carries a step that contradicts the
delivered path and §8.5. Both are reproducible; one is blocking.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 1 (critical). Major (non-blocking): 1. Minor: 5. Nits: 2.

## Verification performed (reproducible; hermetic)

All probes used a scratch `HOME` and a scratch state root under `/tmp/opencode`.
No daemon was started, no probe touched the real `~/.delivery-os-state`, and no
git operation was performed.

- Ticket: `gh issue view 320` → OPEN, milestone `M4: Public release readiness`,
  six ACs; the AC4/AC6 wording and the GH-310 stop-open constraint match the
  spec and plan.
- `spec §16` parsed: 44 `CHANGED`/`NEW` file paths + one fixture folder
  (`tests/fixtures/entrypoint/prior-identity/`), 11 `UNCHANGED`. Plan scope:
  44 files; set-equal to §16 (0 plan-only, 0 spec-only); the plan's extra folder
  is the change-folder staging prefix. `plan validate GH-320` →
  `verdict=valid tier=full readyForDevelopment=true`.
- Test plan carries 55 unique ids (`TC-BIN-001`..`TC-BIN-084`); the plan's
  TC→PHASE map carries the same 55 once each (13 + 26 + 8 + 4 + 4) and its AC
  matrix reaches all 55, including `TC-BIN-083` (`AC-F7-9`) and `TC-BIN-084`
  (guard half).
- Literal inventory: today four committed identity-literal sites
  (`bin/delivery-os.ts`, `entrypoint.ts` `NEUTRAL_WORKING_NAME`,
  `packages/mcp/src/serve.ts`, `SCOPE_ORG`); after the declared removal and the
  two `jaiship` selectors, five. `neutralWorkingName` and
  `workingNameEnvironmentVariable` are both present today, as stated.
- `status --json` under a valid environment in a fixture checkout with
  `.delivery-os/config.yaml`: exit 0, four `openat(.../.delivery-os/config.yaml,
  O_RDONLY)` calls — iteration-1 finding 1's premise still holds.
- `DELIVERY_OS_WORKING_NAME='bad/name' … status --json`: exit 2, stderr
  `delivery-os: fallback.internal` /
  `command "status" is not part of the composed prompt-required set`, and — in
  the delivered tree — two reads of `.delivery-os/config.yaml`, creation of the
  state directory, and a `host-index.json` write. This is the evidence for
  finding 2.
- `… daemon status` passed as two argv tokens: exit 1, envelope
  `error.code = "fallback.invocation"` under `--json`, stderr
  `unexpected argument "status"`. Passed as one argv token (`"daemon status"`)
  it yields exit 2 `fallback.internal` — the case's note is correct for the
  two-token form, and a harness must spawn two argv tokens.
- `matchSeedLiteral` (the delivered module) over `"ados_distribution:
  redistributable"` → `ados`. The whole text of three registered guides
  (`rename-drill.md`, `milestone-management.md`,
  `tracker-credential-provisioning.md`) also → `ados`. The full scan is green
  today (re-run this iteration: 5/5 scope classes, 157 user-facing docs,
  0 violations) only because `scanFile` line-allowlists lines containing
  `ados_distribution:` (registry `source-headers`); the bare matcher has no
  line allowlist. This is the evidence for finding 1.
- `scripts/.tests/test-doc-distribution.sh` enumerates every
  `doc/guides/*.md` and fails `missing-marker` without `ados_distribution`
  (`:225–228, :330–337`) — the marker is mandatory for the new guide.
- `scripts/install.sh --help` Environment section names `ADOS_REPO_URL`,
  `ADOS_HOME`, `ADOS_REPO_DIR`, `ADOS_SOURCE_DIR` (four); it does not print the
  literal `ADOS_RAW_URL` (the one-liners are its expanded value). The script
  header names all five.
- Registry/scan: seeds `ados`, `ADOS_`, `~/.ados`; `userFacingDocs` scans
  `doc/` excluding `doc/changes/` and `doc/decisions/`; allowlist is exactly the
  DEC-8 set; a newly registered guide must be absent at `corpusBaseline` (it is).
- Plan gates resolve to existing files (`changesets-group.ts`,
  `exports-parity.ts`, `forbidden-literals.ts`, `prompt-conformance.ts`,
  `help-guide-coverage.ts`, `test-doc-distribution.sh`, `test-install.sh`,
  `lint-commit-range.sh`, `node_modules/.bin/delivery-os`); `package.json`
  exposes `check`, `check:help`, `check:prompt`. No plan gate contains
  `--filter`; phase 5 has `mkdir -p "$HOME/.cache"` before the `mktemp` run.
- Installer suite home: phase 3 declares the Bun test
  `tests/checks/install-launcher-installer.test.ts`, no `scripts/.tests` suite,
  and no CI-workflow edit; `scripts/.tests/test-install.sh` is re-run unchanged
  as a control.

## Iteration-1 finding dispositions

All 23 remain closed as verified in iteration 2; the four this round touched
were re-verified against the tree:

| # | Iter-1 severity | Disposition | Basis |
|---|---|---|---|
| 1 | critical | **Closed (re-verified)** | Valid `status --json`: four config reads, exit 0; the composition-time acquisition is real. `config --json` unreachable stays correct. |
| 2 | critical | **Closed (spec side); residual moved to finding 2** | The projection is consistent (`fallback.internal`, exit 2, both bins); the delivered trace shows the *invalid* path also composes (finding 2). |
| 3 | critical | **Closed** | 21 `runEntrypoint(` sites in 17 files; exactly the three named neutral-floor suites are edited for that reason; the required-property design is pinned. |
| 4 | critical | **Closed (re-verified)** | Bun-test home only; no `scripts/.tests` suite; no workflow change; `test-install.sh` re-run as a control. |
| 5 | critical | **Closed (re-verified)** | Four literal sites today, five after the declared change; the entrypoint neutral literal + accessor are present and slated for removal. |
| 6 | major | **Closed** | 44 files set-equal to §16; the folder appears in both artifacts; R-H is only the reconciliation record. |
| 7 | major | **Closed (residual record-drift note)** | TDR-0022 stays unamended; the phase-7 pages carry the extension. |
| 8 | major | **Spec/plan closed; test-plan closure regressed** | By-role rule is coherent; the new seed-free assertion is impossible (finding 1). |
| 9 | major | **Closed (re-verified)** | One executable same-device gate; `mkdir -p` present; repo-local run is evidence only. |
| 10–13 | major | **Closed** | Two-half hermeticity; snapshot-only real-home claim; five-page table; `completion` pinned. |
| 14–23 | minor | **Closed** | `--print-install-path` token; acquisition sites; notice ownership; DEC-15 scrub; F-4 tier; helper untouched; landing page rationale; stdin; shellcheck. |

## Iteration-2 finding dispositions

| # | Iter-2 severity | Disposition | Basis |
|---|---|---|---|
| 1 | blocking (critical) — `TC-BIN-012` | **Partially fixed; residual is major (finding 2)** | The projection is now asserted per invocation shape and verified live: positional-free `status --json` → exit 2 `fallback.internal`; two-token `daemon status` → exit 1 `fallback.invocation` / `unexpected argument "status"`; the alias baseline clause is right. But step 5 ("zero config reads … no state root is opened") and the note's "brand resolution fails before any composition exists" are false in the delivered tree, which reads `.delivery-os/config.yaml` twice and creates/writes the host index under the invalid override; the plan's binding contract says "composition never runs" and §8.5 says the alias is "behaviourally unchanged". The target is implementable, but the spec/step wording must be reconciled (finding 2). |
| 2 | major — guide vs seed scan | **Not closed; made blocking by the remediation** | The by-role rule is coherent and implementable. The added whole-file `matchSeedLiteral(text) === undefined` assertion cannot pass because the mandatory `ados_distribution:` marker matches seed `ados`; the bare matcher has no line allowlist (the delivered scan does), and the "splice each of the three seeds" control is therefore not live for `ados` (finding 1). |
| Plan-side minors from r1.2 | — | **Verified fixed** | Spec v1.4 / test plan v1.3 citations; 44 files + 2 folders with exact set equality; no `--filter` in any plan gate; `TC-BIN-083`/`084` in the AC matrix; obligation 4.6 quotes the delivered sentence verbatim; guide obligations include `ados_distribution`, registration and a full `forbidden-literals` run; census counts 21/17/3 are correct. Residual test-plan-side minors 4, 6 and 8 remain open and are listed below (the test plan itself declares them open in §8.3). |

## Findings

### Blocking

1. [critical] test_traceability / cross_artifact_consistency —
   `chg-GH-320-test-plan.md` TC-BIN-072 step 7 (line 1580), its Expected
   Outcome (line 1586) and §8.3 R-TP-15/iter-2 disposition (lines 1841, 1894);
   `chg-GH-320-plan.yaml` obligation 4.3(d) (lines 769–772) and the phase-4
   gate note (line 802).
   Gap: the assertion `matchSeedLiteral(whole guide text, registry.seedLiterals)
   === undefined` cannot hold for a compliant guide. The guide must declare
   `ados_distribution: redistributable` — mandated by plan 4.3(a), test-plan
   TC-BIN-071 step 1 (line 1546), and the drift guard, which fails
   `missing-marker` for any `doc/guides/*.md` without it. The delivered matcher
   matches seed `ados` in `ados_distribution` (verified against the delivered
   module: `ados_distribution: redistributable` → `ados`; the whole text of
   every registered guide today → `ados`). The full scan is green only because
   `scanFile` line-allowlists `ados_distribution:`; the bare matcher does not.
   The splice negative control is also non-live for `ados`, because the base
   guide already matches. The phase-4 gate therefore cannot satisfy 4.3(a) and
   4.3(d) at once as written.
   Suggested remediation target phase: test_planning (with delivery_planning for
   plan 4.3(d) and the gate note)
   Suggested fix: define the seed-free assertion over the guide's
   body/divergence section with the frontmatter and the allowlisted header lines
   excluded, using the delivered per-line + line-allowlist semantics (or assert
   zero violations for the guide via the delivered `scan`), and keep the splice
   negative control on that same input. State the marker-line exemption
   explicitly in TC-BIN-072 and plan 4.3(d).

### Major (non-blocking)

2. [major] system_spec_consistency / cross_artifact_consistency —
   `chg-GH-320-spec.md` §2.1 (line 71) and §8.5 first bullet (line 323);
   `chg-GH-320-plan.yaml` "BINDING SPEC-v1.4 CONTRACTS" (line 283) and
   obligation 2.6 (line 577); `chg-GH-320-test-plan.md` TC-BIN-012 step 5
   (line 492).
   Gap: the spec says an invalid override "falls back … **for
   self-description only**" and that the alias is "behaviourally unchanged …
   every command's behaviour … exactly as delivered", while the plan says
   "composition never runs in the invalid state" and TC-BIN-012 step 5 asserts
   "zero reads of `.delivery-os`/`.jaiship` configuration … no state root is
   opened". The delivered tree does the opposite: with
   `DELIVERY_OS_WORKING_NAME='bad/name'` and a fixture `.delivery-os/config.yaml`,
   `status --json` exits 2 `fallback.internal` **after** two reads of that file
   and after creating the state directory and writing `host-index.json` (the
   lenient brand fallback is used to compose; only the strict config program
   throws). The strict target is implementable and is pinned by the plan, but it
   is a side-effect change to the alias that §8.5's absolute wording denies.
   A coder can satisfy either the plan/test plan or §8.5, not both as written.
   Suggested remediation target phase: specification (with test_planning for
   step 5's wording and delivery_planning for the contract line)
   Suggested fix: narrow §8.5/§2.1 to the observable projection and state that
   the invalid-override path no longer composes, so the delivered incidental
   config read and host-index write under an invalid override do not recur; or
   keep the delivered lenient path and delete step 5's zero-read/no-state
   clause. Keep the alias baseline scoped to version/help/projection.

### Minor

3. [minor] test_traceability — `chg-GH-320-test-plan.md` TC-BIN-070 step 2
   (line 1521). Gap: the stale phrase is still quoted as "the bin is not part
   of the install surface"; the delivered sentence is "The bin is not part of
   the install or release surface." (verified at
   `doc/spec/features/feature-cli-entrypoint.md:99`), and a substring check on
   the quoted text passes on today's file. Plan 4.6 correctly requires the
   delivered sentence verbatim with a full-sentence check, so the plan is
   non-vacuous; the test plan is stale. This is iteration-2 minor 6, still open
   in §8.3.
   Suggested remediation target phase: test_planning
   Suggested fix: quote the delivered sentence verbatim and make it a
   full-sentence assertion, matching plan 4.6.

4. [minor] cross_artifact_consistency — `chg-GH-320-test-plan.md` TC-BIN-071
   step 5 (line 1550). Gap: still says "at least one" of the four spec pages
   links the guide and carries the self-undermining landing-page rationale
   ("every existing redistributable guide is already listed there" argues for
   adding the row). Plan R-D requires all four and restates the reason as the
   M4-S1 deferral. This is iteration-2 minor 8, still open in §8.3.
   Suggested remediation target phase: test_planning
   Suggested fix: align step 5 with plan R-D ("all four pages"; the landing
   page is deferred to the M4-S1 remainder).

5. [minor] test_traceability — `chg-GH-320-test-plan.md` harness entries.
   Gap: 82 `--filter` occurrences remain, including the §5 table row for
   TC-BIN-072 (`--filter divergences`, line 1813) while the case body uses
   `-t "divergences"` (line 1566). Under the pinned Bun 1.4.4 `--filter` is
   ignored and the whole file runs, so the case never fails loudly on a
   mis-typed filter. The plan gates are clean and state the correct convention,
   so this is test-plan-side only; this is iteration-2 minor 4, still open in
   §8.3.
   Suggested remediation target phase: test_planning
   Suggested fix: replace with `-t/--test-name-pattern`, or drop the flag and
   state that each harness entry runs its whole file; make the §5 table and the
   case body agree.

6. [minor] plan_coverage — `chg-GH-320-plan.yaml` "DECLARED DEFAULT SELECTOR
   INPUT" (lines 132–150). Gap: the census counts are now correct (21
   `runEntrypoint(` sites in 17 delivered test files; 3 edited), but the prose
   says the remaining 14 files are "UNAFFECTED and NOT edited", and
   `tests/structure/entrypoint-bin.test.ts` is in that remainder while phase 1
   edits it (it supplies `configuredWorkingName: "delivery-os"` at line 77 and
   gains two-bin assertions). The classification is wrong for that one file,
   even though its call site needs no identity change.
   Suggested remediation target phase: delivery_planning
   Suggested fix: say "14 files need no identity change at their call sites; 3
   of them are edited for unrelated phase obligations" or name the exception.

7. [minor] cross_artifact_consistency — `chg-GH-320-test-plan.md` TC-BIN-072
   step 9 (line 1582). Gap: it requires the installer `--help` to "reference
   `ADOS_RAW_URL` in its install one-liners"; the rendered help expands the
   variable and names only four identifiers (`ADOS_REPO_URL`, `ADOS_HOME`,
   `ADOS_REPO_DIR`, `ADOS_SOURCE_DIR`), while the change record names all five.
   A literal-string check on the help output would fail; a check on the value
   or the script header would pass. The wording should say which is asserted.
   Suggested remediation target phase: test_planning
   Suggested fix: assert the one-liner's URL equals the `ADOS_RAW_URL` value (or
   assert the script header), and keep the change-record half for the fifth
   identifier.

### Nits

8. [nit] ac_quality / spec_completeness — `chg-GH-320-spec.md` AC-F2-7
   (line 517) and DEC-11 (line 423) keep the universal "any
   configuration-bearing command" → `fallback.internal`, while the test plan
   narrows the obligation to the positional-free shape and records the
   subcommand-bearing parse failure (`daemon status` → `fallback.invocation`,
   exit 1) as a secondary fact. The plan's binding contract already states the
   per-shape rule; consider narrowing the AC/DEC wording so a phase-8 reader
   cannot apply the universal quantifier to `daemon status`.
   Suggested remediation target phase: specification

9. [nit] cross_artifact_consistency — `chg-GH-320-pm-notes.yaml` retro
   (lines 217–220) says "Minors fixed in plan r1.2", while the test plan §8.3
   correctly records minors 4, 6 and 8 as still open on the test-plan side. The
   plan-side fixes are real; the PM record overstates the closure.
   Suggested remediation target phase: test_planning (and PM record hygiene)

## Notes (verified, no action)

- Ticket fidelity: OPEN, milestone M4, six ACs. AC4's literal `status --json`
  surface is kept and `config --json` is proven unreachable; the two discloseable
  deviations (no `.delivery-os/config.yaml` in this checkout, so a fixture; the
  state half on a scratch counterpart) are in §12 and DEC-14. GH-310 is the
  stop-open constraint; the plan's PR target is `main-tools`.
- Appendix A still matches the resolver for both identities; `SCOPE_ORG`
  derivation is unchanged; the resolver is code-UNCHANGED and out of every
  phase scope.
- The guide's by-role rule is implementable: a divergence-section body with no
  seed tokens returns `undefined`; the `ados_distribution` marker is the only
  collision. The installer help is a viable pointer: its header names all five
  identifiers and the change record is exempt from the scan.
- The `daemon status` projection is argv-shape sensitive by construction; a
  harness must pass two argv tokens. The case's note is accurate for that form.
- The plan's phase-4 gate `bun run scripts/checks/forbidden-literals.ts` reports
  the five scope classes; registration of the new guide is baseline-aware
  (absent at `corpusBaseline`), so the scan can be green with the guide
  registered.
- The repo-local `TMPDIR=$PWD/tmp/tmpdir pnpm check` form from the ticket is
  recorded as evidence, not a gate (D10), as iteration 1 accepted; the plan's
  gate is the same-device `$HOME/.cache` invocation with `mkdir -p`.

## Next

Reopen `test_planning` for finding 1 (blocking), 3, 4, 5, 7 and the test-plan
half of 9; `delivery_planning` for finding 1's plan half and finding 6;
`specification` for findings 2 and 8.
Do not start delivery until this gate returns `READY`. No human input is
required: finding 1 is a narrow, mechanically fixable assertion-form defect, not
a stalemate on a previously rejected requirement. This is the third iteration;
if the next pass again leaves an unattainable assertion, escalate to the owner
rather than iterating indefinitely.
