# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-365
Date: 2026-11-21
Pause Required: no

## Scope of the review

Read in full: `chg-GH-365-spec.md` v1.4, `chg-GH-365-test-plan.md` r0.3,
`chg-GH-365-plan.yaml` (ten phases), `chg-GH-365-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`,
`doc/decisions/TDR-0074-project-groups-document-operator-local-overlay.md`,
`doc/decisions/00-index.md`, the GitHub #365 body plus both owner comments
(`gh issue view 365`), and the delivered surfaces the change claims to extend:

- `packages/cli/src/index.ts` (the `runCli` audit write), `packages/cli/src/edge.ts`
  (`createProductionDependencies`, `stateDirectoryFor`, `createConfigProgram`,
  `NEUTRAL_OVERRIDE_NAME`), `packages/cli/src/entrypoint.ts`
  (`workingNameEnvironmentVariable` and the override read),
  `packages/cli/src/bin-launcher.ts`, the two CLI bins, `packages/mcp/src/serve.ts`;
- `packages/core/src/contracts/{audit,install,config,error-table}.ts`,
  `packages/core/src/state/audit.ts`, `packages/core/src/domain/install-migration.ts`,
  `packages/core/src/branding/index.ts`;
- `packages/adapters/src/legacy/index.ts`, `packages/adapters/src/git/commit.ts`
  (candidate collection and `git add -A -- <paths>`),
  `packages/adapters/src/file/{provider-migrate-source,decision-register}.ts`;
- `scripts/checks/forbidden-literals.ts` and `.registry.json`,
  `scripts/checks/ignore-rules.ts`, `scripts/checks/changesets-group.ts`,
  `scripts/checks/(ci-topology|ci-bindingness|help-guide-coverage).ts`,
  `packages/cli/src/help/prompt-required-commands.ts`,
  `tests/structure/install-conformance.test.ts`,
  `tests/checks/{ignore-rules,forbidden-literals,identity-docs,install-lifecycle-docs}.test.ts`,
  `tests/fixtures/state/harness.ts`, `tests/fixtures/install/home.ts`;
- the live tracked tree via `git grep` over `packages/**`, `.opencode/**`,
  `scripts/**`, `tools/**`, `doc/**`, root manifests, `.gitignore`,
  `.git/info/exclude`, and the registered-doc list.

Mechanical checks re-performed rather than assumed: `jaiship plan validate GH-365`
(verdict `valid`, `tier=full`, `readyForDevelopment=true`, ten phases) and
`jaiship lint plan GH-365` (valid, zero errors); spec §17 **31** AC rows (31
unique); test-plan matrix **31** rows with **37** links (6 extras: AC-F1-2 +2,
AC-F1-3 +1, AC-F3-1 +2, AC-F3-5 +1); **36** detail sections = 36 index rows, 34
AC-linked + 2 NFR-only; mutation register **55** rows, M1–M55 contiguous with
allocation `5+3+5+5+21+3+4+8+1 = 55`; plan scope arithmetic **168** file entries
over **122** unique file paths + **1** folder entry; install domain **11**
identities; `PROMPT_REQUIRED_COMMANDS` **28** with `install` 26th; TDR-0074
tracked, `doc/decisions/00-index.md` row present, all **76** index links on disk
and tracked, `git status --porcelain -- doc/decisions` empty; the status of
`.git/info/exclude` lines for both roots.

The remediation materially improved the artifacts: the two schema ids, the
symlink rule, the managed-`PATH` residual, the `unscoped` scope, the
`ADOS_WORKING_NAME` exception in prose, the declared-prefix property and the
P1 gate-ordering rule are all now coherent. A set of new cross-artifact defects
(seven blocking, S18–S24) and one delivery-environment blocker (C10) remain;
they are listed below.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

---

## A. Disposition of iteration-1 findings

| ID | Disposition | Evidence |
|----|-------------|----------|
| S1 (scan neutral site / allowlist independence) | **Resolved (mechanism)**; residual site-authority gap is new S20 | DM-4 (spec line 269) declares `packages/core/src/branding/index.ts` a neutral site (`prior-executable`, budget 1), states allowlist independence, and dispositions the two docs; plan C1/P3 3.1 adds the same; `git grep` confirms exactly one bare `SCOPE_ORG = "delivery-os"` (branding/index.ts:63). |
| S2 (audit pair vs zero-state-records) | **Partially resolved** | Text now separates "no migration record" from the destination audit pair (DM-7, API-1, AC-F3-3/004, §8.5, §10). The seam itself is still not feasible as worded — new S18. |
| S3 (derived disposition + composition) | **Partially resolved** | DM-6 row 5 names `already-migrated` and states one composition rule; but the derived entries' `absent` rule and the retirement rule now contradict DM-6 — new S19. |
| S4 (two schema ids) | **Resolved** | `install.migration.plan.v1` / `install.migration.manifest.v1` in DM-5, API-2, Appendix F, glossary, AC-F3-3, test plan TC-MIGRATE-004 step 4 and plan P5 5.3. |
| S5 (symlink) | **Resolved** | AC-F3-1, DM-6 symlink rule (evaluated before the byte rules), DM-8, F-3 step 6, §12, §22, Flow 2, TC-MIGRATE-001 steps 10–11, plan P5 5.5. |
| S6 (managed `PATH` residual) | **Resolved** | AC-F3-3, DM-6 residual, API-2, §22/§23, plan P5 5.5, TC-MIGRATE-004 step 8; the detection reads the recorded `{file, marker}` and never writes. |
| S7 (`unscoped`) | **Resolved** | F-3 step 1, DM-6 root scope, API-2, AC-F3-1, glossary, §10, Appendix F, TC-MIGRATE-001 step 12, plan P5 5.1. |
| S8 (glossary / opencode docs) | **Resolved** | Appendix A glossary row now names both stale rows; DOD-9 grep covers them and the `opencode-model-configuration.md` path line; P3/P9 scopes include both pages. |
| S9 (DEC-3/DEC-6 no extra record) | **Resolved** | §15.1 records the ruling; pm-notes R7; no additional TDR. |
| S10 (committed baseline) | **Resolved** | AC-F3-7 proof and TC-MIGRATE-009 step 7 compare against a committed literal baseline, never a branch. |
| S11 (AC-F1-2 declared-prefix property) | **Partially resolved** | The property and M55 exist, but "fails only this criterion" is not achievable because TC-SCAN-003 is also AC-F5-3's only owner — new S24/B13. |
| S12 (undeclared occurrences) | **Resolved** | NFR-5 and §4.1 now read **0 undeclared occurrences**; test plan §3.3/§7.6 mirror it. |
| S13 (AC-F3-2 bound) | **Resolved** | AC-F3-2 now bound by NFR-2 with the single counted truncation line; TC-MIGRATE-003 step 8 asserts it. |
| S14 (`ADOS_WORKING_NAME` exception) | **Partially resolved** | Prose is consistent across DEC-9, §8.5 row 12, F-6(c), API-5, AC-F6-3, RSK-9, Appendix A/F; the composition is not implementable as planned — new S23. |
| S15 (F-5 fifth tree check) | **Resolved** | F-5 tree-arm bullet, AC-F5-3, TC-SCAN-003 step 5. |
| S16 (ADR-0003 DEC-8 qualification) | **Resolved** | All remaining bare `DEC-8` references resolve to this change's own DEC-8 or are `ADR-0003 DEC-8`-qualified. |
| S17 (plan-time root) | **Resolved** | DM-6 retirement now says "a source root that **existed at plan time**". |
| B1 (derived token) | **Resolved** (token) | TC-MIGRATE-007 step 2 uses `already-migrated`/`absent`; A5 cites DM-6. The `absent` semantics remain contradictory — S19. |
| B2 (audit records) | **Partially resolved** | TC-MIGRATE-004 step 7 / TC-MIGRATE-010 step 6 assert exactly the two records at the destination; the refusal row and pre-move timing remain — S18/B6. |
| B3 (TC-ROOT-004 targets) | **Resolved** | The two composition suites are explicitly not edited; TC-ROOT-004 targets `config-cli` + the delivered `projects-groups-list`. |
| B4 (`--dry-run --stop-daemon`) | **Resolved** | TC-MIGRATE-002 step 7. |
| B5 (help-coverage verify-only) | **Resolved** | TC-MIGRATE-012 target line says verify-only. |
| C1 (P3 alignment set / `SCOPE_ORG`) | **Partially resolved** | The seven-document + prompt set and the neutral site are in P3, with mechanical grep derivation. The five scanned pages are not declared sites and P3 cannot edit the shim registry — C11. |
| C2 (changeset in P2) | **Resolved** | Plan 2.0 and P2 scope author it; P10 verify-only. |
| C3 (pre-freeze fixture in P2) | **Partially resolved** | The fixture is in P2 so the site exists; the fixture is in no scanned corpus and is misassigned to the wrong shim — S20/S21. |
| C4 (literal-free guide rule) | **Resolved** | P9 9.1 names the script, never the literal; the ADR-0003 DEC-8 allowlist is not widened. |
| C5 (three permanent doc sites) | **Partially resolved** | P2 lists all three, but **all three** are unregistered and therefore unscanned, and the plan calls them "never reworded" although two currently present the prior names as current — S20/C25. |
| C6 (P7 real batteries) | **Resolved** | P7 declares `config-cli` + `projects-groups-list`; the two composition suites are explicitly not edited. A residual test-plan contradiction remains — C23. |
| C7 (catalog module in P8) | **Resolved** | P8 declares `packages/core/src/config/catalog.ts`; contracts selector or injected key set stated. |
| C8 (count fix) | **Resolved** | The "six documents" error is gone; the new "eight files" arithmetic is a separate nit — C18. |
| C9 (P1 gate ordering) | **Resolved** | GATE ORDERING block plus P1's execution-order note; commit first, gate the committed head. |

No iteration-1 finding **regressed**.

---

## B. New findings by owning artifact

### B.1 `specification` (remediation target: `specification`)

**S18 — [critical] cross_artifact_consistency / spec_completeness — `chg-GH-365-spec.md` DM-7 (line 272), API-1 (line 250), §8.5 "What stays exactly as delivered" (line 282), AC-F3-1 (line 498), AC-F3-2 (line 499), AC-F3-3 (line 500), AC-F3-4 (line 501); `chg-GH-365-test-plan.md` TC-MIGRATE-001 step 8 (line 693), TC-MIGRATE-003 step 5 (line 766), TC-MIGRATE-004 step 7 (line 806); `chg-GH-365-plan.yaml` P5 obligation 5.7 (lines 1344–1354) and P5 scope (lines 1460–1492).**

- **Gap:** The audit contract is not implementable as written against the delivered seam.
  `packages/cli/src/index.ts:614–651` writes the audit pair **after** the command
  outcome for **every** invocation whose composition carries an audit dependency,
  including failures (`install.dev-build`, `install.target.worktree`,
  `install.daemon.running`, and even `fallback.invocation` grammar failures). The
  pair's facts are post-outcome by type: `exitCode`, `timing`, `outcomeClass`
  (`packages/core/src/contracts/audit.ts:154–166`), and `appendAuditInvocation`
  writes both records at `record(...)`
  (`packages/core/src/state/audit.ts:440–495`). Consequently:
  1. **Before the first move:** the delivered pair cannot exist before the move,
     because its exit code/timing/outcome class are only known after the command
     completes. The spec demands "after the plan is composed and before the first
     move" (DM-7, API-1, plan 5.7, TC-MIGRATE-004 step 7).
  2. **Exactly two records:** if the migration handler writes a pair early, the
     runner's post-outcome write adds a second pair (four records), failing
     "exactly two"; if the runner's write is suppressed for this command, the
     "same pair every invocation writes" / "unchanged in kind" claims in DM-7,
     API-1 and §8.5 are false.
  3. **Dry-run and refusals:** AC-F3-2 requires a dry run to append "no record of
     any kind", and AC-F3-1/TC-MIGRATE-001 step 8 require zero records on every
     refusal — but the runner appends the pair on a dry run and on every refusal
     unless the migration is declared an exception and the runner path is changed.
  The artifacts never name the mechanism (no suppression, no alternate sink, no
  declared exception), and P5's scope does not declare
  `packages/cli/src/index.ts`, where the post-outcome write lives.
- **Required fix:** Declare the audit contract precisely and make it executable.
  Choose one: (a) the migration writes its pair **after the outcome** at the
  destination root and the "before the first move" ordering is removed from
  DM-7/API-1/AC-F3-3/TC-MIGRATE-004 step 7; or (b) a distinct pre-move record
  (not "the delivered pair") is introduced and the delivered pair still lands
  post-outcome. In both cases declare the **dry-run/refusal exception**
  explicitly (zero audit records for a dry-run and for every admission refusal,
  with the runner-side suppression named and scoped), reconcile §8.5/DM-7/API-1's
  "every invocation gets" and "unchanged in kind" language, and add
  `packages/cli/src/index.ts` (and any other changed composition file) to P5's
  scope.
- **Target:** `specification` (coordinate `test_planning` for B6 and
  `delivery_planning` for P5 scope).

**S19 — [major] cross_artifact_consistency / ac_quality — `chg-GH-365-spec.md` F-3 step 6 (line 136), step 7 (line 137), DM-6 (line 271), glossary "Disposition" (line 624); `chg-GH-365-test-plan.md` TC-MIGRATE-006 steps 1–8 (lines 871–879), TC-MIGRATE-007 steps 2 and 5 (lines 910, 913).**

- **Gap:** Two contradictions in the derived-entry rule.
  1. **`absent` vs the ordered table.** F-3 step 7, the glossary and
     TC-MIGRATE-007 step 2 assign `absent` to a derived entry when the source is
     present and the destination has no copy. DM-6 row 1 defines `absent` as
     *source absent, destination absent*, and DM-6 row 5 only covers "both present
     and differing". The ordered table would therefore evaluate a source-present /
     destination-absent derived entry at row 3 (`moved`), not `absent`. A validator
     keyed on the closed vocabulary cannot accept a source-present `absent`
     without an explicit derived rule evaluated before row 3.
  2. **Retention vs retirement.** DM-6 "Retirement" removes a source root whose
     entries are all `absent`/`already-migrated` after the run. A host state root
     whose only remaining entry is the derived `host-index.json` (source) satisfies
     that and would be removed — deleting the retained source index. This
     contradicts F-3 step 6 ("Only an entry the run itself moved disappears from
     the source"), TC-MIGRATE-007 step 5 ("the source `host-index.json` is
     **retained** … the source root keeps it as a reported residual rather than
     being retired on its account"), and the "never delete a difference"
     posture.
- **Required fix:** Add an explicit derived-entry rule **before** the byte rules
  (source present / destination absent → a named token, e.g. `absent` redefined as
  "no action, no move" rather than "source absent"), and either exempt a root with
  a retained derived entry from retirement or declare that the derived source
  entry is removed with the retired root and update TC-MIGRATE-007 step 5. State
  the `absent` definition so the closed vocabulary is one definition.
- **Target:** `specification` (coordinate `test_planning` for B7).

**S20 — [major] system_spec_consistency / cross_artifact_consistency — `chg-GH-365-spec.md` DM-3 (line 268), DM-4 (line 269), AC-F4-2 (line 512), NFR-6 (line 314), F-5 content-arm bullet (line 146); `chg-GH-365-test-plan.md` TC-SHIM-002 step 1 (line 526); delivered `scripts/checks/forbidden-literals.ts:330–443`.**

- **Gap:** The declared-site authority cannot be reconciled over the scanned
  corpora the design names.
  - `userFacingDocs` scans **only** the post-baseline `registered` list
    (`presentDocs` are checked against `baselineDocs`, and `scannedDocs =
    registry.registered`), and a registered doc that existed at
    `corpusBaseline` is a hard failure (`registered doc is present at
    corpusBaseline`). Therefore the **three permanent doc sites** of Appendix F
    and P2 — `doc/spec/features/feature-autonomous-delivery.md`,
    `doc/guides/delivery-modes.md`, `doc/quality/test-specs/test-spec-autonomous-delivery.md`
    — and the glossary (`doc/overview/glossary.md`, declared a site of four shims
    by DM-3) can never be scanned: all four existed at `corpusBaseline`, and none
    is in `registered` (verified; the delivered scan reports 200 registered docs,
    none of these four). Adding any of them to `registered` would trip the
    baseline rule. `doc/guides/opencode-model-configuration.md` is likewise
    unregistered (it is reworded, not declared, so that is harmless for the
    scan).
  - `tests/**` is in no scope class at all (`packageTree` = `packages`,
    `promptSurface` = `.opencode`, `scriptSurface` = `scripts`+`tools`), so the
    prior-identity harness and the eight-variable pre-freeze fixture — declared
    sites — can never be "matched".
  - AC-F4-2 and TC-SHIM-002 step 1 nevertheless assert that **every declared
    site is reported present and *matched* at or below its budget**. For those
    sites a match count is structurally zero, so the assertion is either false
    or vacuous; NFR-6's "100% of matches inside a declared site" is true only
    because the site is never scanned.
- **Required fix:** Choose and state one: (a) extend `userFacingDocs` to all
  docs (declaring the change to the `registered`/baseline semantics, the corpus
  list, and the seven-class count) and add a `testSurface` class for the
  fixtures (which changes NFR-5/Appendix F and AC-F5-1's six-class claim), or
  (b) declare that a declared site outside the scanned corpora is a
  **declaration-only** entry (present, zero matches permitted) and restate
  AC-F4-2/TC-SHIM-002 to "every match inside a declared site; every declared
  site present", dropping the "matched" claim. Either way, say which docs and
  fixtures are sites and why.
- **Target:** `specification` (coordinate `test_planning` for B11 and
  `delivery_planning` for C13).

**S21 — [major] cross_artifact_consistency — `chg-GH-365-spec.md` DM-3 (line 268), Appendix F (line 750); `chg-GH-365-plan.yaml` P2 obligation 2.3(e) (lines 878–879), 2.6 (lines 895–900).**

- **Gap:** The eight-variable pre-freeze fixture is declared a site of
  `prior-environment-prefix`, whose literal is `DELIVERY_OS_`, but the fixture
  holds `ADOS_CONFIG_ROOT`, `ADOS_STATE_DIR`, … and `ADOS_FOO=bar` — the
  `pre-freeze-environment-prefix` (`ADOS_`) literal, not `DELIVERY_OS_`. The actual
  implementation sites of the pre-freeze literals —
  `packages/adapters/src/legacy/index.ts:65–66`
  (`LEGACY_ENV_PREFIX = "ADOS_"`, `LEGACY_CONFIG_DIRECTORY = ".ados"`) and its
  provider table — are absent from P2's enumeration entirely. The pre-freeze
  shims would have a site with zero matches of their literal and no truthful
  implementation site, while the fixture's real literal is a different shim.
- **Required fix:** Assign the fixture to `pre-freeze-environment-prefix`;
  add the legacy adapter constants/table (and any other surviving `ADOS_`/`.ados`
  implementation site) as `pre-freeze-*` sites; remove the misassigned
  `prior-environment-prefix` entry. If the fixture stays a declaration, record
  that it is a data fixture, not a scan site (S20's disposition).
- **Target:** `specification` (coordinate `delivery_planning` C13).

**S22 — [major] ac_quality / cross_artifact_consistency — `chg-GH-365-spec.md` AC-F6-1 (line 531), DM-9 (line 274), §8.5 row 7 (line 294); `chg-GH-365-test-plan.md` TC-IDENTITY-001 steps 1 and 3 (lines 1311, 1313); `packages/cli/bin/delivery-os.ts:14`.**

- **Gap:** AC-F6-1 requires "each composed surface … **zero** prior-namespace
  paths" on a clean home and the test plan explicitly includes "the alias's
  non-lifecycle composition". The alias's declared default working name is
  `delivery-os` (`packages/cli/bin/delivery-os.ts:14`), unchanged and declared a
  shim by DM-9/§8.5 row 7, and the delivered composition resolves the configured
  name → override → bin default. With no configured name and no override, an
  alias non-lifecycle invocation resolves the prior identity and creates
  `~/.delivery-os` / `~/.delivery-os-state` paths. The criterion's blanket claim
  cannot hold for the alias; the test plan does not exclude it or run it under
  the current override.
- **Required fix:** Scope AC-F6-1 to the current-identity surfaces (primary CLI,
  entrypoint, MCP with no configured name), and state that the alias's declared
  prior default is a declared shim (not part of the fresh-install claim), or run
  the alias row under the current override and say so. Align TC-IDENTITY-001.
- **Target:** `specification` (coordinate `test_planning` B8).

**S23 — [major] cross_artifact_consistency / feasibility — `chg-GH-365-spec.md` DEC-9 (line 400), F-6(c) (line 150), API-5 (line 254), API-6 (line 255), AC-F6-3 (line 533); `packages/cli/src/edge.ts:5001` and `packages/cli/src/entrypoint.ts:175`; `chg-GH-365-plan.yaml` P8 obligations 8.1 and 8.4 (lines 1794–1827).**

- **Gap:** The declared `ADOS_WORKING_NAME` → `<environmentPrefix>WORKING_NAME`
  exception is not implementable through the mechanism the plan names. The
  override is read from the **raw** environment (`edge.ts:5001`,
  `entrypoint.ts:175`) **before** `createLegacyCompat(...).resolveConfigFacts`
  runs, and the legacy adapter's mapped environment is passed only to the
  configuration layer (`acquireFileConfig`/`resolveConfig`), not to the override
  read. The plan (8.4) puts the exception "in the mapping table as data (one
  row)" in the adapter — where it cannot reach the override. Additionally, the
  prefix that names the mapped variable is derived from the working name the
  override supplies (circular), and a mapped `JAISHIP_WORKING_NAME` placed in the
  resolver's environment would itself need to be added to the resolver's excluded
  names or it can trigger `config.environment.unmapped`.
- **Required fix:** State the actual precedence and seam: the legacy
  `ADOS_WORKING_NAME` is consulted **at the override seam before brand/prefix
  derivation** (alongside `DELIVERY_OS_WORKING_NAME`) and does not travel through
  the catalog-key mapping; the mapped current override name is excluded from the
  configuration-layer strictness; the plan's 8.4 "mapping table" language is
  corrected to name that seam. (The catalog-key bound for every other `ADOS_*`
  name remains as stated.)
- **Target:** `specification` (coordinate `delivery_planning` P8; test plan B9).

**S24 — [major] ac_quality / test_traceability — `chg-GH-365-spec.md` AC-F1-2 proof column (line 481); `chg-GH-365-test-plan.md` TC-SCAN-003 step 8 (line 567) and its Notes (line 575); `chg-GH-365-plan.yaml` assumption (j) (lines 599–602).**

- **Gap:** AC-F1-2's distinguishing property is "one mutation that hardcodes the
  prefix set fails **only** this criterion — the real tree stays green and every
  other tree-arm criterion is unaffected". The mutation `M55` fails
  `TC-SCAN-003`, which is also the **only** owning case for AC-F5-3. A failing
  case therefore fails both criteria at the case level; DOD-1's "each owning case
  ran green" cannot attribute the failure to AC-F1-2 alone. The test plan's
  "the only row whose expected failure is `AC-F1-2` alone" is not achievable
  without per-assertion attribution or a split case.
- **Required fix:** Either split the reported-prefix-set assertion into its own
  case (owned by AC-F1-2) or state that `M55` fails one assertion inside
  TC-SCAN-003 while the AC-F5-3 assertions remain green and DOD attribution is
  per assertion. Update the spec's proof column, the test-plan note, and the
  plan's assumption (j).
- **Target:** `specification` (coordinate `test_planning` B13).

**S25 — [minor] cross_artifact_consistency — `chg-GH-365-spec.md` Flow 2 (line 174) vs F-3 step 4 (line 134), AC-F3-6 (line 503), `chg-GH-365-test-plan.md` TC-MIGRATE-008 step 3 (line 945).**

- **Gap:** Flow 2 writes the manifest **after** the per-entry moves, while F-3
  step 4 and AC-F3-6/TC-MIGRATE-008 require the backup (with its manifest)
  complete for **all n** planned entries before any move so a mid-loop failure
  still leaves a complete backup.
- **Required fix:** Move "write the manifest" before the first move in Flow 2,
  or state that the manifest is written after the backup copies and before the
  first move.
- **Target:** `specification`.

**S26 — [minor] system_spec_consistency — `chg-GH-365-spec.md` §2.1 (line 56).**

- **Gap:** The snapshot says "In `doc/**` it appears in **thirteen** files" and
  then enumerates fourteen (three stale guides + one example guide + glossary +
  MCP surface + autonomy + branding + CLI entrypoint + config + two M1 snapshot
  pages + one inception analysis record + one quality test spec). `git grep`
  confirms fourteen files. The count is stale by one.
- **Required fix:** Correct the count (or the enumeration) to fourteen.
- **Target:** `specification`.

**S27 — [nit] cross_artifact_consistency — `chg-GH-365-spec.md` OQ-1 (line 385).**

- **Gap:** OQ-1's context says "the ceremony mirror resolves its target set from
  **another checkout's** members", while TDR-0074/DEC-12 and the delivered
  contract (`feature-ceremony-runner.md:440`) say the target set is composed from
  the **invoking** checkout's own document (members naming other checkouts). The
  resolution is correct; the context sentence misstates today's behaviour.
- **Required fix:** Reword the context to "the invoking checkout's own
  `projects.yaml` members (whose `root` names other checkouts)".
- **Target:** `specification`.

---

### B.2 `test_planning` (remediation target: `test_planning`)

**B6 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-MIGRATE-001 step 8 (line 693), TC-MIGRATE-003 step 5 (line 766).**

- **Gap:** "For every refusal row, assert … no state record was appended" and
  "the store saw **0 records appended of any kind**" on a dry run are false
  against the delivered `runCli` audit seam, which appends the
  `audit.reservation` + `audit.invocation` pair after **every** outcome,
  including refusals, whenever the composition carries audit. As written the
  cases fail on a real composition; if the harness omits the audit dependency to
  make them pass, TC-MIGRATE-004 step 7's "exactly two audit records" cannot be
  proven (the fixture would prove the fixture).
- **Required fix:** Once S18 is decided, assert the exact declared record set per
  arm (for a refusal/dry-run: the declared zero or the named exception; for an
  apply: the exact pair at the destination, ordered as the spec says), and keep
  the audit dependency present in the D2 battery so the pair is observable.
- **Target:** `test_planning`.

**B7 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-MIGRATE-007 step 2 (line 910) and step 5 (line 913).**

- **Gap:** Step 2 assigns `absent` to a source-present derived entry (contradicts
  DM-6's ordered table); step 5 asserts the source `host-index.json` is retained
  and the root is not retired on its account (contradicts DM-6's retirement
  rule). Both cannot pass with DM-6 as written.
- **Required fix:** Align with S19's resolved derived rule and retirement rule;
  keep the mutation `M21`/`M22` families and the never-moved/never-conflict
  invariants.
- **Target:** `test_planning`.

**B8 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-IDENTITY-001 steps 1 and 3 (lines 1311, 1313).**

- **Gap:** The alias is included in the "only current-identity paths" case, but
  its declared default is prior (S22). The case fails as written on a clean home
  with no configured name/override.
- **Required fix:** Either run the alias under the current override (and say so)
  or remove it from the strict current-path assertion and assert its declared
  prior default as a separate shim fact.
- **Target:** `test_planning`.

**B9 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-IDENTITY-003 step 8 (line 1386).**

- **Gap:** The row asserts `ADOS_WORKING_NAME` reaches the current override
  channel and no `config.environment.unmapped` is raised. With the delivered
  override read before the legacy mapping, and the mapped name not excluded from
  the resolver, the row cannot pass without the composition change S23
  describes.
- **Required fix:** Assert the resolved working name through the seam the spec
  declares (read the override from the legacy facts before brand resolution) and
  assert the mapped override name is excluded from the configuration-layer
  strictness; keep the "no configuration key added" assertion.
- **Target:** `test_planning`.

**B10 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-MIGRATE-012 step 2 (line 1114) vs TC-MIGRATE-011 step 7 (line 1084) and spec API-3 (line 252).**

- **Gap:** "The install family's declared flag set … no longer contains
  `--migrate`" conflicts with "`install --migrate` … a summary naming the retired
  flag form and the remedy". `packages/cli/src/index.ts` only produces a
  recognized-flag summary when the flag is in `definition.flags`; if
  `--migrate` is removed from `definition.flags`, the parser answers
  `fallback.invocation` with the generic "unknown flag" reason and never reaches
  the handler's remedy. `tests/structure/install-conformance.test.ts:129` pins
  `definition.flags`.
- **Required fix:** Distinguish the **parser grammar** (retains `--migrate` as a
  recognized, refused flag so the remedy is produced) from the **documented/help
  flag set** (no longer lists it as supported). State which pin changes and
  which stays; align TC-MIGRATE-012 step 2 with TC-MIGRATE-011 step 7.
- **Target:** `test_planning` (coordinate `delivery_planning` C14).

**B11 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-SHIM-002 step 1 (line 526), TC-SHIM-001 precondition (line 414).**

- **Gap:** "Every declared site is reported present **and matched** at or below
  its `maxOccurrences`" is unachievable for the declared sites outside the
  scanned corpora (S20/S21), including the pre-freeze fixture and the three
  permanent doc sites. The case will either fail or be made vacuous.
- **Required fix:** Follow S20's disposition: assert presence for all declared
  sites, and assert matched-at-or-below-budget only for sites inside a scanned
  corpus; name the declaration-only sites explicitly (or add the corpora).
- **Target:** `test_planning`.

**B12 — [minor] ac_quality — `chg-GH-365-test-plan.md` TC-SCAN-001 step 7 (line 457).**

- **Gap:** "Assert the delivered ADR-0003 DEC-8 five-class/three-seed/five-allowlist
  exact-shape validation still **rejects a five-class registry** …" is
  self-contradictory: the delivered validation accepts five classes; after the
  widening it must accept seven and reject five. The sentence's first clause
  describes the old shape.
- **Required fix:** State that the widened exact-shape validation accepts exactly
  seven classes and rejects the old five-class registry by name, while the
  delivered ADR-0003 DEC-8 seed/allowlist exact shape is unchanged.
- **Target:** `test_planning`.

**B13 — [major] ac_quality / test_traceability — `chg-GH-365-test-plan.md` TC-SCAN-003 step 8 (line 567), Notes (line 575), and §7.4 M55 row (line 1754).**

- **Gap:** The same attribution problem as S24: `M55` fails `TC-SCAN-003`, whose
  own AC-F5-3 evidence then cannot be green; "the only row whose expected failure
  is `AC-F1-2` alone" is not a case-level fact.
- **Required fix:** Split the reported-prefix-set assertion into a separate case
  or state per-assertion attribution; update the Notes and the M55 expected
  family accordingly.
- **Target:** `test_planning` (with the spec S24).

---

### B.3 `delivery_planning` (remediation target: `delivery_planning`)

**C10 — [critical] plan_coverage — `chg-GH-365-plan.yaml` P1 gate/execution order (lines 749–781), P1 scope (lines 788–809), `local` `.git/info/exclude` line 22; `packages/adapters/src/git/commit.ts:247`; `packages/core/src/domain/commit-staging.ts:35–73`.**

- **Gap:** On this workstation `.git/info/exclude` hides `.jaiship/` (line 22,
  verified with `git check-ignore -v .jaiship/config.yaml`). The commit primitive
  builds its candidate set from `git status` (`packages/adapters/src/git/commit.ts`)
  and stages with `git add -A -- <paths>`; an ignored untracked
  `.jaiship/config.yaml` is invisible to that candidate set (and an explicit
  `git add` of an ignored path is refused). P1 therefore cannot stage the moved
  layer, `git ls-files .jaiship/config.yaml` is empty, and P1's d1/d2/d3 cannot be
  green — the fresh-clone drill will clone a head with no current configuration
  file. The plan never mentions the local exclude or a force-add.
- **Required fix:** Add a P1 precondition/step: remove the local
  `.git/info/exclude` entries for `.delivery-os/` and `.jaiship/` **before**
  staging (a local, uncommitted operator action; the change still commits no
  exclude file), or force-add the declared destination path through the commit
  primitive and state how. Add a done-criterion assertion that
  `git check-ignore .jaiship/config.yaml` exits 1 before the gate. The fresh-clone
  drill already asserts the clone has no exclude; the workspace itself is the
  missing half.
- **Target:** `delivery_planning`.

**C11 — [major] plan_coverage — `chg-GH-365-plan.yaml` P3 obligation 3.6 (lines 1036–1053), P3 scope (lines 1118–1143), P2 obligation 2.3 (lines 852–882).**

- **Gap:** P3 restates the five **scanned registered** pages
  (`feature-cli-entrypoint.md`, `feature-branding-seam.md`,
  `feature-mcp-surface.md`, `provider-conditions-and-parks.md`,
  `ceremony-runner.md`) and says each "treats the prior literal as the shim P2
  already declares". But P2's site enumeration does not include any of those
  five pages, and P3 cannot edit the shim registry (its own interaction note says
  the registry is consumed, not edited). If any restated page retains
  `DELIVERY_OS_WORKING_NAME` or `.delivery-os`, P3's content arm is red and P3
  has no legal way to declare it. The two unregistered pages P3 also restates are
  not scanned at all (S20), so their restatement is documentation work, not a
  gate condition.
- **Required fix:** State explicitly that the five scanned pages must be **free of
  prior-namespace literals** after P3 (name the shim by id, not the literal), or
  move their site declarations into P2/P9 with role sentences and budgets. State
  which of the two dispositions applies to each page; remove the ambiguity
  "treats the prior literal as the shim".
- **Target:** `delivery_planning` (with the spec S20).

**C12 — [major] plan_coverage — `chg-GH-365-plan.yaml` P9 obligation 9.6 (lines 2059–2066) vs `chg-GH-365-spec.md` DM-3 (line 268).**

- **Gap:** Spec DM-3 declares `doc/overview/glossary.md` a site of **four** shims
  (`prior-config-directory`, `prior-state-directory`,
  `prior-environment-prefix`, `prior-working-name-override`). P9 9.6 adds the
  glossary only as a site of `prior-working-name-override` and (for the
  reference-declaration row) `prior-config-directory`. The glossary's added §24
  rows contain `.delivery-os-state`, `DELIVERY_OS_*` and `delivery-os`, so the
  state-directory and environment-prefix sites are missing. The two artifacts
  disagree on the same addition.
- **Required fix:** Add all four sites with role sentences and occurrence budgets
  in P9 (or correct DM-3 to the two the plan intends, if the other literals are
  not meant to remain on the page — but §24's "Prior namespace" row makes them
  remain). Say which shim each row belongs to.
- **Target:** `delivery_planning` (with the spec DM-3).

**C13 — [major] plan_coverage / plan_code_area_coverage — `chg-GH-365-plan.yaml` P2 obligation 2.3(a)–(e) (lines 852–882), `packages/adapters/src/legacy/index.ts:65–66`.**

- **Gap:** The site enumeration omits the primary pre-freeze implementation site
  (`LEGACY_ENV_PREFIX = "ADOS_"`, `LEGACY_CONFIG_DIRECTORY = ".ados"`, and the
  provider migration table). The seven shim families include
  `pre-freeze-environment-prefix` and `pre-freeze-config-directory`, but no
  truthful site for either is enumerated; the only fixture named (the
  eight-variable fixture) is assigned to the wrong shim (S21).
- **Required fix:** Add the legacy adapter constants/table as the pre-freeze
  sites, correct the fixture's shim, and state the budgets. Keep the
  catalog-key-bounded mapping plan (8.4) unchanged.
- **Target:** `delivery_planning` (with the spec S21).

**C14 — [major] plan_coverage — `chg-GH-365-plan.yaml` P6 obligation 6.4 (lines 1534–1536), P6 code area (line 1570), `tests/structure/install-conformance.test.ts:129`.**

- **Gap:** P6 says the install flag list "loses `--migrate`" and the pin is
  updated, while API-3/TC-MIGRATE-011 require a recognized refusal with the
  remedy. Removing `--migrate` from `definition.flags` makes the parser answer a
  generic unknown-flag error and never reach the remedy; keeping it means the pin
  does not lose it. P6 cannot do both.
- **Required fix:** Keep `--migrate` in the parser grammar (recognized) and
  retire it from the help/reference flag documentation and the retirement note;
  update the install-conformance pin to the new entry count but not to delete
  the grammar flag; say which assertion changes.
- **Target:** `delivery_planning` (with test plan B10).

**C15 — [minor] plan_coverage — `chg-GH-365-plan.yaml` P7 obligation 7.3 (lines 1694–1697).**

- **Gap:** 7.3 says P7 authors `golden/notices.ts` with the five golden lines
  "(four delivered reasons plus `override-read`, whose reason is added in P8)"
  and then says "P7 authors the file; P8 adds the fifth golden line." Both cannot
  be true.
- **Required fix:** P7 authors the four delivered lines; P8 adds the fifth
  (`override-read`) with its reason.
- **Target:** `delivery_planning`.

**C16 — [minor] plan_coverage — `chg-GH-365-plan.yaml` P7 done criterion d4 (line 1748).**

- **Gap:** "the proof boundary's **eight/five** assertions" is wrong; the
  boundary is eight proven + eight not-proven with five planted controls
  (Appendix G/TC-IDENTITY-006).
- **Required fix:** "the eight-proven/eight-not-proven boundary with five planted
  controls".
- **Target:** `delivery_planning`.

**C17 — [minor] cross_artifact_consistency — `chg-GH-365-plan.yaml` header line 51 vs `chg-GH-365-test-plan.md` §7.1 (line 1569).**

- **Gap:** The plan header cites "§7.1 the **eleven** seams"; the test plan's
  §7.1 says thirteen seams/rows. The header source summary is stale.
- **Required fix:** "thirteen seams".
- **Target:** `delivery_planning`.

**C18 — [minor] cross_artifact_consistency — `chg-GH-365-plan.yaml` header line 220.**

- **Gap:** "seven documents plus one prompt pair (**eight files**)" is nine files:
  seven documents plus `.opencode/agent/toolsmith.md` plus its generated
  `.ados-claude/agents/toolsmith.md` projection.
- **Required fix:** nine files (or "eight paths plus the generated projection").
- **Target:** `delivery_planning`.

**C19 — [minor] plan_coverage — `chg-GH-365-plan.yaml` assumption (f) (lines 573–575), P3 scope line 1125.**

- **Gap:** The plan says `tests/checks/identity-docs.test.ts` asserts the exact
  scope-class order and P3 restates it. The file does not assert `scopeClasses`;
  the five-class pin is `tests/checks/forbidden-literals.test.ts:60` plus
  `EXPECTED_SCOPE_IDS` in `scripts/checks/forbidden-literals.ts:15–21`. P3
  declares both the real pin file and identity-docs; the identity-docs declaration
  is a verify-only/no-edit path, contrary to the plan's own scope rule.
- **Required fix:** Correct the pin-update target to `forbidden-literals.test.ts`
  (and the `EXPECTED_SCOPE_IDS` constant), and drop or mark verify-only the
  `identity-docs.test.ts` declaration.
- **Target:** `delivery_planning`.

**C20 — [minor] plan_coverage — `chg-GH-365-plan.yaml` P10 done criterion d3 (lines 2256–2257) and P10 gate (lines 2244–2250).**

- **Gap:** d3 requires "exactly one minor changeset covers the lockstep group",
  but the P10 gate runs `changesets-group.ts` (config only, it does not count
  changeset files) and `namespace-shims-registry.test.ts` (window equality; the
  plan does not require it to count changesets). The "exactly one" claim is not
  mechanically observed.
- **Required fix:** Add an assertion (in the registry test or the retirement
  suite) that the change's changeset exists exactly once and lists the five
  lockstep packages, or state that "exactly one" is a lifecycle-phase check
  recorded in pm-notes and drop it from the P10 gate signal.
- **Target:** `delivery_planning`.

**C21 — [minor] plan_coverage / arithmetic — `chg-GH-365-pm-notes.yaml` line 155 (`161 declared file entries over 121 unique paths`).**

- **Gap:** The current plan declares **168** file entries over **122** unique
  paths + 1 folder. The pm-notes record is stale; the plan itself states no
  count, so the ledger is the only recorded claim and it no longer matches.
- **Required fix:** Append a pm-notes `notes:` entry with the corrected
  arithmetic (168/122/1) and the scope-rule note; do not rewrite the historical
  entry.
- **Target:** `delivery_planning`.

**C22 — [nit] plan_coverage — `chg-GH-365-plan.yaml` P9 obligations (lines 2028–2047).**

- **Gap:** "9.3 Reconcile the guides and the M4 blueprint" appears twice,
  identically. The numbering is duplicated.
- **Required fix:** Renumber the second block or delete the duplicate.
- **Target:** `delivery_planning`.

**C23 — [minor] plan_coverage / plan_code_area_coverage — `chg-GH-365-plan.yaml` P7 scope (line 1766), P9 scope (line 2171), P7 obligation 7.2 (line 1690); `chg-GH-365-test-plan.md` TC-ROOT-004 target line (line 1235) and §6.1 "Deliberately unchanged" (line 1551).**

- **Gap:** The test plan says `projects-groups-list.test.ts` is "assertions reused,
  **not edited**" and `rename-drill-doc.test.ts` is deliberately unchanged; the
  plan declares both in phase scope (P7 and P9 respectively) and P7's obligation
  7.2 says "Update … `projects-groups-list.test.ts`". Under the plan's own scope
  rule, a verify-only file is not declared; under the test plan, it is not edited.
  One of the two must change.
- **Required fix:** Decide: either P7/P9 edit the files (then update the test
  plan's "not edited" wording) or they do not (then remove them from scope and
  treat them as regression controls). For `rename-drill-doc.test.ts`, state the
  condition once.
- **Target:** `delivery_planning` (with test plan alignment).

**C24 — [major] plan_code_area_coverage — `chg-GH-365-plan.yaml` P5 scope (lines 1460–1492), P5 obligation 5.7 (lines 1344–1354).**

- **Gap:** S18's required audit suppression/ordering change lives in the shared
  runner (`packages/cli/src/index.ts:614–651`) or in a composition file; P5's
  scope declares `edge.ts` but not `packages/cli/src/index.ts`. If the fix is
  implemented where the delivered write exists, the commit primitive refuses the
  edit as undeclared and the blast radius is not explicit.
- **Required fix:** Add `packages/cli/src/index.ts` (and any other changed
  composition file) to P5's scope and state the exact suppression/ordering seam.
- **Target:** `delivery_planning` (with the spec S18).

**C25 — [major] plan_coverage — `chg-GH-365-plan.yaml` P2 obligation 2.3(d) (lines 869–877), header C5 (lines 122–125) vs `chg-GH-365-spec.md` Appendix A (lines 654, 661) and DOD-9 (line 551).**

- **Gap:** P2 declares the three "permanent doc sites" (`feature-autonomous-delivery.md`,
  `doc/guides/delivery-modes.md`, `doc/quality/test-specs/test-spec-autonomous-delivery.md`)
  and says they "DEFINE the prior namespace as prior, so they are declared, **never
  reworded**". Verified text: `feature-autonomous-delivery.md:113,119,242,311,312`
  and `doc/guides/delivery-modes.md:207,210,225,239–240` call
  `DELIVERY_OS_OWNER_HOLD*` and `$HOME/.delivery-os-state/owner-hold` "the current
  default brand's name(s)" — exactly the "presented as current" shape DM-4 says
  must be reworded. Appendix A (lines 654, 661) requires P9 to stop calling them
  the current brand names; DOD-9's stale-statement grep would hit them if P2's
  "never reworded" is followed. Declaring them as sites does not make the current
  prose a declaration.
- **Required fix:** Say that the three pages are **reworded in P9** (to name them
  as the example hook's declared `prior-environment-prefix` shim) **and** remain
  declared sites for the surviving literal mentions; remove "never reworded" and
  align the header C5, P2 2.3(d), and P9's Appendix A obligation.
- **Target:** `delivery_planning` (with the spec's Appendix A/DOD-9 wording).

---

## C. Verified correct (do not churn these)

- **Plan validity:** `jaiship plan validate GH-365` → `verdict=valid`,
  `tier=full`, `readyForDevelopment=true`, ten phases; `jaiship lint plan GH-365`
  → valid, zero errors.
- **AC/TC arithmetic:** 31/31 ACs (4+4+8+4+6+5), 31 matrix rows, 37 links
  (6 extras: AC-F1-2 ×3, AC-F1-3 ×2, AC-F3-1 ×3, AC-F3-5 ×2), 36 detail
  sections = 36 index rows; 34 AC-linked + 2 NFR-only; 0 orphans/0 double-owned
  in the plan's phase map; every matrix phase agrees with the index and the
  plan's TC→phase map.
- **Mutation arithmetic:** 55 rows M1–M55 contiguous; per-phase allocation
  `P1 5, P2 3, P3 5, P4 5, P5 21, P6 3, P7 4, P8 8, P9 1 = 55`; every M id
  appears once; `M35` (P8), `M51` (P9), `M55` (P4) follow their owning cases.
- **Fixture arithmetic:** 21 reused / 7 extended / 11 authored; 13 new test
  hosts; 13 seams in the test plan §7.1.
- **TDR/index:** TDR-0074 tracked (`git ls-files --error-unmatch` exits 0);
  `doc/decisions/00-index.md` row present; all 76 index links exist and are
  tracked; `git status --porcelain -- doc/decisions` empty. The record stays
  `Proposed`; the PR is the acceptance point.
- **Baseline claims re-verified:** install domain 11 identities;
  `PROMPT_REQUIRED_COMMANDS` 28 with `install` 26th and `provider` last; five
  `packages/**` files with `.delivery-os`/`DELIVERY_OS_`; one `.opencode` file;
  seven `scripts/**` files; fourteen `doc/**` files (see S26); one bare
  `SCOPE_ORG = "delivery-os"` in `packages/core/src/branding/index.ts:63`;
  `.gitignore` has the brand-free `.*/config.local.yaml`; `.git/info/exclude`
  hides both roots; `packages/adapters/src/legacy/index.ts` is the `ADOS_`/`.ados`
  implementation site; the MCP default and override literals are where the spec
  says they are.
- **DoD shape:** ten DoD items, each with an observation instrument; DOD-1 ties
  to the 31/31 matrix; DOD-2/3/5 keep the aggregate, range gate and scratch
  proof out of the per-phase battery; DOD-9's grep covers the two glossary rows,
  the opencode configuration path and the `projects.yaml` committed claim.
- **Test-plan revision log:** 0.1, 0.2, 0.3 present and complete; 0.3 records
  B1–B5, the spec v1.4 consequences, 55 mutations, 31/31 ACs and the unchanged
  phase map. The plan header cites spec v1.4 / test plan r0.3.

---

## Verdict

NOT_READY

| Facet | Status |
|---|---|
| spec_completeness | FAIL |
| ac_quality | FAIL |
| plan_coverage | FAIL |
| test_traceability | PASS |
| cross_artifact_consistency | FAIL |
| decision_capture | PASS |
| system_spec_consistency | FAIL |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | FAIL |
| dod_defined | PASS |

**Blocking set (must be resolved before delivery):** S18, S19, S20, S21, S22,
S23, S24; B6–B11, B13; C10, C11, C12, C13, C14, C24, C25. The minors/nits can be
fixed in the same pass: S25–S27, B12, C15–C23.

**One consolidated remediation pass, by owning artifact:**
1. `specification` — S18 (audit contract/mechanism), S19 (derived rule and
   retirement), S20 (declared-site/scanned-corpus authority), S21 (pre-freeze
   sites), S22 (AC-F6-1 alias), S23 (`ADOS_WORKING_NAME` seam), S24 (AC-F1-2
   attribution), S25–S27.
2. `test_planning` — B6–B11, B13; B12.
3. `delivery_planning` — C10 (staging blocker), C11–C14, C24, C25; C15–C23.
Then re-run this gate as iteration 3. If the same blocking set persists after
that pass, escalate to the human rather than looping.

Pause Required: no

No finding needs an owner decision outside the artifacts: S18/S19/S23 need a
declared design choice the PM can make in the change docs (as R1/R2 did), S22/
S24 need a criterion-scoping correction, and C10 is an environment action the
plan can state. None changes product scope beyond the ticket.
